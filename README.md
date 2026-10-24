# Bingoor

Quick-commerce platform. One repository, four projects:

| Folder | What it is | Stack |
| --- | --- | --- |
| `bingoor-backend` | API (customers, riders, warehouses, admin), plus the rider app in `bingoor-mobile` | Express, MongoDB, TypeScript |
| `bingoor-web` | Customer website (bingoor.com) | Next.js |
| `bingoor-admin` | Super admin and warehouse panel (admin.bingoor.com) | Next.js |
| `blinkit-app-` | Customer mobile app | React Native |

Each folder has its own `package.json`; install and run them separately. Secrets (database URL, JWT, payment and login keys) are never stored in this repository: the server keeps them in its environment, and Razorpay / Google / Facebook keys are saved from the admin panel under "Login & Payments".

## Deploying to the cPanel server

Everything (backend, website, admin panel) goes live with one command in the
cPanel terminal:

```
bash ~/bingoor-project/deploy.sh
```

It pulls `main`, rebuilds all three, restarts the cPanel Node.js apps and
prints the status code of each live URL. A full log is kept in `~/deploy-logs/`.
The `.env` files, MongoDB and the cPanel app settings are never touched.
