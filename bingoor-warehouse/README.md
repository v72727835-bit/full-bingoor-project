# Bingoor Warehouse app

React Native app for warehouse owners (package `com.bingoor.warehouse`). It signs in with the warehouse's own login
(`/seller/auth/login`) and uses the same `/seller/*` API as the warehouse panel on the website.

What it does: dashboard, orders (accept / prepare / ready / reject / cancel, assign a free rider, vibrates on a new
order), products (add / edit / photos / live-off / delete), inventory (quick stock), categories, riders (add), customers,
store settings (open/close, fee, minimum order, radius, address) and account (change password, log out).

Not in the app (use the website panel): CSV bulk upload and product video upload.

## Build the APK (Windows)

```
npm install
cd android
.\gradlew.bat assembleRelease
```

The APK is `android\app\build\outputs\apk\release\app-release.apk`. API URL: `src/config.ts`.
