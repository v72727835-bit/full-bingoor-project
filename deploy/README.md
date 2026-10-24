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

The website and admin get their API URL at build time (`NEXT_PUBLIC_API_URL`,
default `https://api.bingoor.com/api/v1`).

## What a deploy does

1. Builds new images while the old containers keep serving. A failed build
   changes nothing.
2. Restarts the containers and checks each app answers 200.
3. If one does not, starts the previous images again and the GitHub run fails.

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

4. First deploy: run the **Deploy to server** workflow from the Actions tab
   (or push to `main`). The first run copies the API `.env` and uploads from
   the old pm2 install in `/opt/bingoor`, switches the site from pm2 to
   Docker, and removes the pm2 apps once the containers are healthy.

If `deploy/ci-entry.sh` changes, copy it to `/usr/local/bin/bingoor-deploy` again.
