#!/usr/bin/env bash
# Daily MongoDB backup for Bingoor (run by cron on the VPS, see deploy/README.md).
#
# Reads MONGO_URI from the API's env file, writes one compressed archive per day
# to $BACKUP_DIR and keeps the last $KEEP_DAYS days. Uses mongodump when it is
# installed, otherwise the official mongo image (host network, so localhost works).

set -euo pipefail

ENV_FILE="${BINGOOR_ENV_DIR:-/opt/bingoor-env}/backend.env"
BACKUP_DIR="${BACKUP_DIR:-/opt/bingoor-backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

uri="$(grep -E '^MONGO_URI=' "$ENV_FILE" | head -1 | cut -d= -f2- | sed -e 's/^["'"'"']//' -e 's/["'"'"']$//')"
if [ -z "$uri" ]; then
  echo "MONGO_URI not found in $ENV_FILE" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
out="$BACKUP_DIR/bingoor-$(date +%F-%H%M).archive.gz"

if command -v mongodump >/dev/null 2>&1; then
  mongodump --uri="$uri" --archive="$out" --gzip --quiet
else
  docker run --rm --network host -v "$BACKUP_DIR:/backup" mongo:7 \
    mongodump --uri="$uri" --archive="/backup/$(basename "$out")" --gzip --quiet
fi

chmod 600 "$out"
find "$BACKUP_DIR" -name 'bingoor-*.archive.gz' -mtime +"$KEEP_DAYS" -delete
echo "Backup written: $out ($(du -h "$out" | cut -f1))"
