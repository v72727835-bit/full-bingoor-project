# Firebase: phone OTP and push notifications

Everything is switched on from the super admin panel: **Login & Payments → Phone OTP & push notifications (Firebase)**.
No server change or redeploy is needed to change keys or turn features on or off.

## 1. Create the Firebase project (one time)

1. console.firebase.google.com → Add project.
2. **Authentication → Sign-in method → Phone → Enable.**
   Authentication → Settings → **Authorized domains**: add `bingoor.com`.
3. **Project settings → General → Your apps → Web app**: copy the config (apiKey, authDomain, projectId, appId, messagingSenderId) into the admin panel.
4. **Project settings → Cloud Messaging → Web Push certificates → Generate key pair**: paste it as the *Web push key (VAPID)*.
5. **Project settings → Service accounts → Generate new private key**: open the downloaded JSON and paste the whole text into *Service account JSON* in the admin panel (it is stored encrypted and is never shown again). Do not share this file anywhere else.
6. Press **Save Firebase**, then **Test push setup** (Google must accept the service account).

## 2. Website

Works as soon as the keys are saved. Push on the website needs a browser that supports notifications and permission from the customer.

## 3. Customer app and rider app (Android)

The apps use the native Firebase SDK, so one file is baked into each APK and cannot come from the admin panel:

1. In the Firebase project add two Android apps: `com.bingoor.app` (customer) and `com.bingoor.rider` (rider).
2. Download each `google-services.json` and put it in
   - `blinkit-app-/android/app/google-services.json`
   - `bingoor-backend/bingoor-mobile/android/app/google-services.json`
3. Add the debug and release **SHA-1 and SHA-256** fingerprints of each app in Firebase (Project settings → your Android app). Phone OTP does not work without them.
4. `npm install` in each app, then build the APK again.

Builds without `google-services.json` still compile and run; they just cannot show the OTP step or receive push.

## 4. Turning OTP on

The OTP options are **off by default**. Old app versions cannot show an OTP step, so customers/riders on them would be locked out.
Turn them on only after the website is deployed **and** the new apps are released:

- *Ask for an OTP when a new account is created*
- *Ask for an OTP on every login (customers and riders)*

How it works: the server answers `428 otp_required`; the website/app sends the SMS through Firebase, the user types the code, and the login/sign-up is repeated with a Firebase ID token that the server verifies against Google's public certificates.
Social (Google/Facebook) logins are not affected.

## 5. What gets a notification

| Event | Who |
| --- | --- |
| Order placed / payment successful | customer; admins and the warehouse's sellers get "new order" |
| Accepted, packing, packed, out for delivery, delivered, cancelled, rejected | customer |
| Order packed (ready for pickup) or dropped by a rider | all free riders of that warehouse |
| Rider assigned by the store | that rider |
| Cancelled while with a rider | that rider |

## Notes

- Firebase phone SMS is free only up to a monthly quota; beyond that the Blaze plan is needed. SMS to India must be allowed in Authentication → Settings → SMS region policy.
- Push failures never block an order; dead device tokens are removed automatically.
