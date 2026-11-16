# Deploying Bingoor to the VPS

The API, website and admin panel run as Docker containers on the VPS
(`docker-compose.yml` at the repository root). Every push to `main` goes live
by itself: `.github/workflows/deploy.yml` connects to the server over SSH, the
server pulls `main` and runs `deploy/docker-deploy.sh`.

| App | Container | Port (aaPanel proxies the domain here) |
| --- | --- | --- |
| API | `bingoor-api` | 5000 (api.bingoor.com) |
| Website | `bingoor-web` | 3000 (bingoor.com) |
| Admin | `bingoor-admin` | 5173 (admin.bingoor.com) |

Server-only files, never in git:

- `/opt/bingoor-env/backend.env`: the API's `.env` (database, JWT secrets).
- `/opt/bingoor-data/uploads`: files older builds wrote to disk.
- `/opt/bingoor-data/downloads`: the app APKs, served at api.bingoor.com/downloads.
  The Build APKs workflow pushes them to the `apk-builds` branch and runs the deploy
  key with `apks`, which only copies them here (no rebuild); every deploy refreshes them too.

The website and admin get their API URL at build time (`NEXT_PUBLIC_API_URL`,
default `https://api.bingoor.com/api/v1`).

## What a deploy does

1. Builds new images while the old containers keep serving. A failed build
   changes nothing.
2. Restarts the containers and checks each app answers 200.
3. If one does not, starts the previous images again and the GitHub run fails.
4. Empties the aaPanel proxy caches so no cached page points at old CSS/JS.

Logs: `/var/log/bingoor-deploy/` on the server, and the run in the GitHub
**Actions** tab. To deploy by hand: `bash /opt/bingoor-src/deploy/docker-deploy.sh`.

## One-time server setup

Run these as root in the server terminal.

1. Install Docker:

   ```
   curl -fsSL https://get.docker.com | sh && docker compose version
   ```

2. Let the server pull this repository with a read-only deploy key:

   ```
   ssh-keygen -t ed25519 -N "" -C bingoor-server -f /root/.ssh/bingoor_github
   printf 'Host github.com\n  IdentityFile /root/.ssh/bingoor_github\n  IdentitiesOnly yes\n' >> /root/.ssh/config
   ssh-keyscan github.com >> /root/.ssh/known_hosts
   git -C /opt/bingoor-src remote set-url origin git@github.com:v72727835-bit/full-bingoor-project.git
   cat /root/.ssh/bingoor_github.pub
   ```

   On GitHub: repository **Settings > Deploy keys > Add deploy key**, paste the
   printed line, leave "Allow write access" off.

3. Give GitHub Actions a key that can only run the deploy:

   ```
   install -m 755 /opt/bingoor-src/deploy/ci-entry.sh /usr/local/bin/bingoor-deploy
   ssh-keygen -t ed25519 -N "" -C github-actions -f /root/.ssh/bingoor_actions
   echo "command=\"/usr/local/bin/bingoor-deploy\",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty $(cat /root/.ssh/bingoor_actions.pub)" >> /root/.ssh/authorized_keys
   cat /root/.ssh/bingoor_actions
   ```

   On GitHub: **Settings > Secrets and variables > Actions**, add
   `DEPLOY_HOST` = the server IP and `DEPLOY_SSH_KEY` = the whole printed
   private key. Then delete it from the server:
   `rm /root/.ssh/bingoor_actions`.

4. Turn off aaPanel's global proxy cache for the three sites (Next.js does its
   own caching, and a cached page or API answer goes stale after a deploy):

   ```
   for s in bingoor.com admin.bingoor.com api.bingoor.com; do mkdir -p /www/server/panel/vhost/nginx/extension/$s && echo 'proxy_cache off;' > /www/server/panel/vhost/nginx/extension/$s/no-cache.conf; done
   nginx -t && /etc/init.d/nginx restart
   ```

5. First deploy: run the **Deploy to server** workflow from the Actions tab
   (or push to `main`). The first run copies the API `.env` and uploads from
   the old pm2 install in `/opt/bingoor`, switches the site from pm2 to
   Docker, and removes the pm2 apps once the containers are healthy.

If `deploy/ci-entry.sh` changes, copy it to `/usr/local/bin/bingoor-deploy` again.

## Daily database backup

`deploy/mongo-backup.sh` dumps MongoDB (using `MONGO_URI` from
`/opt/bingoor-env/backend.env`) to `/opt/bingoor-backups`, one gzipped archive
per run, and keeps 14 days. Schedule it once as root:

```
install -m 755 /opt/bingoor-src/deploy/mongo-backup.sh /usr/local/bin/bingoor-backup
(crontab -l 2>/dev/null; echo '30 2 * * * /usr/local/bin/bingoor-backup >> /var/log/bingoor-backup.log 2>&1') | crontab -
```

Restore one: `mongorestore --uri="$MONGO_URI" --gzip --archive=/opt/bingoor-backups/<file>.archive.gz`.
Copy the folder off the server now and then (a backup on the same disk does not survive a lost VPS).

## Security settings to check in backend.env

- `CORS_ORIGINS`: leave unset to allow only bingoor.com, www.bingoor.com and
  admin.bingoor.com, or list your domains comma-separated. `*` allows every site.
- `ENCRYPTION_SECRET` (16+ characters): encrypts the payment / login keys saved in
  the admin panel. Without it they are encrypted with `JWT_REFRESH_SECRET`, so
  changing that secret would make the saved keys unreadable. Old keys still
  open after you add it; re-save them under Admin > Login & Payments so they move
  to the new key, and only then is it safe to change `JWT_REFRESH_SECRET`.

## Android release signing

See [ANDROID-SIGNING.md](ANDROID-SIGNING.md).
