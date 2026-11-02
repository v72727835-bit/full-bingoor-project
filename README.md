# Bingoor

Quick-commerce platform. One repository, four projects:

| Folder | What it is | Stack |
| --- | --- | --- |
| `bingoor-backend` | API (customers, riders, warehouses, admin), plus the rider app in `bingoor-mobile` | Express, MongoDB, TypeScript |
| `bingoor-web` | Customer website (bingoor.com) | Next.js |
| `bingoor-admin` | Super admin and warehouse panel (admin.bingoor.com) | Next.js |
| `blinkit-app-` | Customer mobile app | React Native |
| `bingoor-warehouse` | Warehouse (seller) mobile app | React Native |

The three Android apps (customer `com.bingoor.shop`, rider `com.bingoor.delivery`,
warehouse `com.bingoor.store`) are built by `.github/workflows/build-apks.yml` on every
push to `main` that touches them, and served at
`https://api.bingoor.com/downloads/bingoor-{customer,rider,warehouse}.apk`; the
website shows the three download links above its footer. The apps sign in with a
password (no OTP or push service).

Each folder has its own `package.json`; install and run them separately. Secrets (database URL, JWT, payment and login keys) are never stored in this repository: the server keeps them in its environment, and Razorpay / Google / Facebook keys are saved from the admin panel under "Login & Payments".

## Deploying

The live site runs in Docker on the VPS and every push to `main` deploys it
automatically. Setup and details: [deploy/README.md](deploy/README.md).

## Deploying to the old cPanel server

Everything (backend, website, admin panel) goes live with one command in the
cPanel terminal:

```
bash ~/bingoor-project/deploy.sh
```

It pulls `main`, rebuilds all three, restarts the cPanel Node.js apps and
prints the status code of each live URL. A full log is kept in `~/deploy-logs/`.
The `.env` files, MongoDB and the cPanel app settings are never touched.
