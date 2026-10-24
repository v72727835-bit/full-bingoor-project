#!/usr/bin/env bash
# Bingoor: one-command deploy.
#
#   bash ~/bingoor-project/deploy.sh
#
# EVERYTHING SERVER-SPECIFIC LIVES IN THE CONFIG BLOCK BELOW. Moving to a new
# server means editing those few lines and nothing else. They can also be set
# as environment variables, so the script itself never needs changing:
#
#   REPO_DIR=~/app  WEB_URL=https://example.com  bash deploy.sh
#
# Pulls the latest main, rebuilds the backend, website and admin panel, and
# restarts the three cPanel Node.js apps. Server-only files (.env, the
# node_modules symlinks, MongoDB) are never touched.
#
# Why the Next.js apps are built this way: the host's glibc is too old for
# native SWC, it caps processes, and a build run inside the cPanel venv picks
# up a mismatched React. So each site is built with its own real node_modules
# (installed exactly from package-lock.json), and that folder is then moved
# into the cPanel venv and symlinked back, so the running app uses the very
# same packages the build used.

set -euo pipefail

# ----------------------------------------------------------------------------
# CONFIG - the only part that changes from one server to another.
# ----------------------------------------------------------------------------

# Where the checkout lives on this server.
ROOT="${REPO_DIR:-$HOME/bingoor-project}"

# cPanel only: the Node virtualenv it created for the apps. On a plain VPS
# (pm2, systemd, Docker) leave this pointing anywhere unused - it is only read
# when cloudlinux-selector is present.
VENV="${NODE_VENV:-$HOME/nodevenv/bingoor-project}"

# App-root prefix cPanel registered the apps under, normally the folder name.
APP_ROOT_PREFIX="${APP_ROOT_PREFIX:-$(basename "$ROOT")}"

NODE_VER="${NODE_VER:-20}"
LOG_DIR="${LOG_DIR:-$HOME/deploy-logs}"

# The three live URLs, checked after the restart. Set them to this server's own
# domains; a wrong URL here fails a deploy that actually worked.
API_URL="${API_URL:-}"
WEB_URL="${WEB_URL:-}"
ADMIN_URL="${ADMIN_URL:-}"

# ----------------------------------------------------------------------------

ME="$(id -un)"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/deploy-$(date +%Y%m%d-%H%M%S).log"

# The account's process limit counts threads, and MongoDB plus the three live
# apps already use most of it. Build-time Node gets a small libuv pool (and
# next.config.ts limits the build to one CPU worker) so npm and next build
# fit in what is left.
export UV_THREADPOOL_SIZE=2
BUILD_NODE_OPTIONS="--max-old-space-size=3072"

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
PAUSED=0
fail() {
  printf '\n\033[1;31mDeploy stopped: %s\033[0m\nFull log: %s\n' "$*" "$LOG"
  # Never leave the sites down after a failed build: bring the old versions back.
  if [ "$PAUSED" = 1 ]; then
    echo "Starting the apps again so the sites stay up..."
    for a in autozo-backend autozo-web autozo-admin; do restart_app "$a" || true; done
  fi
  exit 1
}
run() { "$@" >>"$LOG" 2>&1 || fail "'$*' failed (last lines below)$(printf '\n'; tail -25 "$LOG")"; }

# The venv activate script is only for the backend; the Next.js builds use the
# account's plain Node, which must be 20+.
plain_node() {
  if node -v 2>/dev/null | grep -qE '^v(2[0-9])\.'; then return; fi
  for d in /opt/alt/alt-nodejs${NODE_VER}/root/usr/bin /opt/cpanel/ea-nodejs${NODE_VER}/bin; do
    if [ -x "$d/node" ]; then export PATH="$d:$PATH"; return; fi
  done
  fail "Node.js ${NODE_VER} not found on PATH"
}

threads() { ps -u "$ME" -L --no-headers 2>/dev/null | wc -l; }

# Frees the threads a running site holds while it is being rebuilt. The site
# is down for those minutes; restart_app brings it back.
stop_app() {
  local app="$1"
  if command -v cloudlinux-selector >/dev/null 2>&1 &&
    cloudlinux-selector stop --json --interpreter nodejs --app-root "$APP_ROOT_PREFIX/$app" >>"$LOG" 2>&1; then
    :
  else
    pkill -u "$ME" -f "lsnode:$ROOT/$app/" 2>/dev/null || true
  fi
  # Wait for the process to really exit; its threads count against the limit until it does.
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    pgrep -u "$ME" -f "lsnode:$ROOT/$app/" >/dev/null 2>&1 || break
    pkill -u "$ME" -f "lsnode:$ROOT/$app/" 2>/dev/null || true
    sleep 2
  done
  echo "   paused $app while it rebuilds (threads in use: $(threads))"
}

restart_app() {
  local app="$1"
  if command -v cloudlinux-selector >/dev/null 2>&1 &&
    { cloudlinux-selector start --json --interpreter nodejs --app-root "$APP_ROOT_PREFIX/$app" >>"$LOG" 2>&1 || true; } &&
    cloudlinux-selector restart --json --interpreter nodejs --app-root "$APP_ROOT_PREFIX/$app" >>"$LOG" 2>&1; then
    echo "   restarted $app"
  else
    # Passenger also restarts an app when tmp/restart.txt is touched.
    mkdir -p "$ROOT/$app/tmp" && touch "$ROOT/$app/tmp/restart.txt"
    echo "   restart requested for $app (if it still shows old code, press RESTART in cPanel)"
  fi
}

build_next() {
  local app="$1" dir="$ROOT/$1" mods="$VENV/$1/$NODE_VER/lib/node_modules"
  say "Building $app (takes a few minutes)"
  cd "$dir"
  [ -d "$VENV/$app/$NODE_VER" ] || fail "cPanel Node.js app for $app not found at $VENV/$app"

  # Swap the venv symlink for a real folder installed exactly from the lockfile.
  if [ -L node_modules ]; then rm -f node_modules; fi
  if [ -d node_modules ]; then mv node_modules "$HOME/node_modules_${app}_stale_$(date +%s)"; fi
  run npm ci --include=dev --no-audit --no-fund

  rm -rf .next
  run env AUTOZO_LOW_RESOURCE=1 NODE_OPTIONS="$BUILD_NODE_OPTIONS" npx next build --webpack
  [ -f .next/BUILD_ID ] || fail "$app build finished without .next/BUILD_ID"

  # Hand the exact build-time packages to the cPanel app.
  rm -rf "$mods"
  mkdir -p "$(dirname "$mods")"
  mv node_modules "$mods"
  ln -s "$mods" node_modules
  echo "   $app built ($(cat .next/BUILD_ID))"
}

echo "Autozo deploy started $(date). Log: $LOG"
echo "Threads in use right now: $(threads)"

say "Pulling latest code"
cd "$ROOT"
run git fetch origin main
# Tracked files follow main exactly; untracked server files (.env, symlinks) stay.
run git reset --hard origin/main
echo "   now at $(git log -1 --format='%h %s')"

# All three live apps are paused for the whole build, so Node gets the threads
# it needs to start. MongoDB keeps running; sites are down until the restart.
say "Pausing the live apps"
stop_app autozo-backend
stop_app autozo-web
stop_app autozo-admin
PAUSED=1
echo "   threads in use after pausing: $(threads) (MongoDB alone holds about 10-15)"

say "Building backend"
cd "$ROOT/autozo-backend"
[ -f .env ] || fail "autozo-backend/.env is missing"
(
  set +u
  # shellcheck disable=SC1090
  source "$VENV/autozo-backend/$NODE_VER/bin/activate"
  set -u
  cd "$ROOT/autozo-backend"
  # npm needs many threads; skip it when the lockfile is unchanged since the last good install.
  lock="$(sha256sum package-lock.json | cut -d' ' -f1)"
  if [ -d node_modules ] && [ "$(cat node_modules/.autozo-lock 2>/dev/null)" = "$lock" ]; then
    echo "   backend packages unchanged, skipping npm install"
  else
    npm install --include=dev --no-audit --no-fund >>"$LOG" 2>&1 && echo "$lock" > node_modules/.autozo-lock
  fi
  npm run build >>"$LOG" 2>&1
) || fail "backend build failed$(printf '\n'; tail -25 "$LOG")"
echo "   backend built"

plain_node
build_next autozo-web
build_next autozo-admin

PAUSED=0
say "Restarting apps"
restart_app autozo-backend
restart_app autozo-web
restart_app autozo-admin

say "Checking the live sites"
sleep 8
HEALTH_FAILED=0
HEALTH_URLS=()
[ -n "$API_URL" ] && HEALTH_URLS+=("${API_URL%/}/health")
[ -n "$WEB_URL" ] && HEALTH_URLS+=("$WEB_URL")
[ -n "$ADMIN_URL" ] && HEALTH_URLS+=("${ADMIN_URL%/}/login")
if [ ${#HEALTH_URLS[@]} -eq 0 ]; then
  echo "   No URLs configured - skipping the health check."
  echo "   Set API_URL, WEB_URL and ADMIN_URL in the config block above."
fi
for url in ${HEALTH_URLS[@]+"${HEALTH_URLS[@]}"}; do
  code=000
  for attempt in 1 2 3; do
    code=$(curl -s -o /dev/null --connect-timeout 8 -m 20 -w '%{http_code}' "$url" || true)
    [ "$code" = 200 ] && break
    [ "$attempt" = 3 ] || sleep 5
  done
  printf '   %-40s %s\n' "$url" "$code"
  [ "$code" = 200 ] || HEALTH_FAILED=1
done
[ "$HEALTH_FAILED" = 0 ] || fail "A live site is still unavailable after restart. Check cPanel Node.js status and the app's stderr.log; deployment is NOT confirmed healthy."

# Old build folders from earlier manual deploys only waste disk.
rm -rf "$HOME"/node_modules_*_stale_* 2>/dev/null || true

say "Done. Website, admin and backend are on $(cd "$ROOT" && git log -1 --format=%h)."
echo "Codes should be 200. If one is 503, wait a minute and open it again (the first start is slow)."
