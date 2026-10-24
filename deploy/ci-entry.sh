#!/usr/bin/env bash
# Forced command for the GitHub Actions deploy key on the VPS.
#
# Installed as /usr/local/bin/bingoor-deploy and pinned to that key in
# /root/.ssh/authorized_keys (see deploy/README.md), so the key can do nothing
# but this: bring the checkout to the latest main and run the deploy.

set -euo pipefail

SRC="${SRC_DIR:-/opt/bingoor-src}"

git -C "$SRC" fetch -q origin main
git -C "$SRC" reset -q --hard origin/main
exec bash "$SRC/deploy/docker-deploy.sh"
