#!/usr/bin/env bash
# Bingoor: build and start the Docker containers on the VPS.
#
#   bash /opt/bingoor-src/deploy/docker-deploy.sh
#
# GitHub Actions runs this (through deploy/ci-entry.sh) on every push to main;
# it can also be run by hand. The checkout in $SRC must already be at the
# commit to deploy.
#
# New images are built while the old containers keep serving, so a failed
# build changes nothing. After the switch each app must answer 200; if one
# does not, the previous images are started again.
#
# The first run also moves the site off pm2: it copies the API's .env and
# uploads folder from the pm2 install, stops the pm2 apps only once the new
# images are built, and removes them from pm2 once the containers are healthy
# (or starts them again if not).

set -euo pipefail

# ----------------------------------------------------------------------------
# CONFIG - everything server-specific; each can be overridden from the environment.
# ----------------------------------------------------------------------------

SRC="${SRC_DIR:-/opt/bingoor-src}"
export BINGOOR_ENV_DIR="${BINGOOR_ENV_DIR:-/opt/bingoor-env}"
export BINGOOR_DATA_DIR="${BINGOOR_DATA_DIR:-/opt/bingoor-data}"
LEGACY="${LEGACY_DIR:-/opt/bingoor}"   # the old pm2 install, read on the first run
LOG_DIR="${LOG_DIR:-/var/log/bingoor-deploy}"

SERVICES=(api web admin)
PM2_APPS=(bingoor-api bingoor-web bingoor-admin)
HEALTH_URLS=(http://127.0.0.1:5000/health http://127.0.0.1:3000 http://127.0.0.1:5173)

# ----------------------------------------------------------------------------

mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/deploy-$(date +%Y%m%d-%H%M%S).log"

say() { printf '\n==> %s\n' "$*"; }
fail() {
  printf '\nDeploy stopped: %s\nFull log: %s\n' "$*" "$LOG"
  tail -30 "$LOG" 2>/dev/null || true
  exit 1
}

# One deploy at a time: a second push while one is running waits for it.
exec 9>/var/lock/bingoor-deploy.lock
flock 9

cd "$SRC"
echo "Bingoor deploy started $(date). Log: $LOG"
echo "   code: $(git log -1 --format='%h %s')"

# The repo's folders are being renamed autozo-* -> bingoor-*; build whichever exists.
dir_of() { if [ -d "bingoor-$1" ]; then echo "./bingoor-$1"; else echo "./autozo-$1"; fi; }
export BACKEND_DIR="$(dir_of backend)" WEB_DIR="$(dir_of web)" ADMIN_DIR="$(dir_of admin)"

# Server-only files, carried over from the pm2 install the first time.
mkdir -p "$BINGOOR_ENV_DIR" "$BINGOOR_DATA_DIR/uploads"
chmod 700 "$BINGOOR_ENV_DIR"
if [ ! -f "$BINGOOR_ENV_DIR/backend.env" ] && [ -f "$LEGACY/bingoor-backend/.env" ]; then
  cp -a "$LEGACY/bingoor-backend/.env" "$BINGOOR_ENV_DIR/backend.env"
  echo "   copied the API .env from $LEGACY"
fi
[ -f "$BINGOOR_ENV_DIR/backend.env" ] || fail "$BINGOOR_ENV_DIR/backend.env is missing"
if [ -d "$LEGACY/bingoor-backend/uploads" ]; then
  cp -an "$LEGACY/bingoor-backend/uploads/." "$BINGOOR_DATA_DIR/uploads/"
fi

healthy() {
  local url code
  for url in "${HEALTH_URLS[@]}"; do
    code=000
    for _ in 1 2 3 4 5 6 7 8; do
      code=$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$url" || true)
      [ "$code" = 200 ] && break
      sleep 5
    done
    printf '   %-32s %s\n' "$url" "$code"
    [ "$code" = 200 ] || return 1
  done
}

say "Building images (live sites keep running)"
HAD_PREV=0
for s in "${SERVICES[@]}"; do
  if docker image inspect "bingoor-$s:latest" >/dev/null 2>&1; then
    docker tag "bingoor-$s:latest" "bingoor-$s:prev"
    HAD_PREV=1
  fi
done
docker compose build >>"$LOG" 2>&1 || fail "image build failed; nothing was changed"

# pm2 holds the same ports; free them only now that the build has passed.
ON_PM2=0
if command -v pm2 >/dev/null 2>&1 && pm2 describe "${PM2_APPS[0]}" >/dev/null 2>&1; then
  ON_PM2=1
  say "Stopping the pm2 apps"
  pm2 stop "${PM2_APPS[@]}" >>"$LOG" 2>&1 || true
fi

say "Starting containers"
docker compose up -d --remove-orphans >>"$LOG" 2>&1 || true

say "Checking the apps"
sleep 5
if ! healthy; then
  if [ "$HAD_PREV" = 1 ]; then
    say "A site did not come back - starting the previous images"
    for s in "${SERVICES[@]}"; do
      docker image inspect "bingoor-$s:prev" >/dev/null 2>&1 && docker tag "bingoor-$s:prev" "bingoor-$s:latest"
    done
    docker compose up -d --no-build --force-recreate >>"$LOG" 2>&1 || true
  elif [ "$ON_PM2" = 1 ]; then
    say "A site did not come back - going back to pm2"
    docker compose down >>"$LOG" 2>&1 || true
    pm2 restart "${PM2_APPS[@]}" >>"$LOG" 2>&1 || true
  fi
  docker compose logs --tail=40 >>"$LOG" 2>&1 || true
  fail "new version was unhealthy and has been rolled back"
fi

if [ "$ON_PM2" = 1 ]; then
  say "Removing the old pm2 apps (Docker runs the site now)"
  pm2 delete "${PM2_APPS[@]}" >>"$LOG" 2>&1 || true
  pm2 save --force >>"$LOG" 2>&1 || true
fi

docker image prune -f >>"$LOG" 2>&1 || true
say "Done. Live on $(git log -1 --format=%h)."
