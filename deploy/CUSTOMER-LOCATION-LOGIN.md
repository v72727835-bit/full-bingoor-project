# Customer login and delivery maps

Deploy the backend, website and admin together, then rebuild both customer and rider Android apps. The map surface is served by the website at `/mobile-map.html`; older deployed websites will not have this page. Map keys continue to come from Admin → Login & Payments → Google Maps. Keep the Maps JavaScript API key restricted to Bingoor website domains. Enable Maps JavaScript API, Geocoding API and the directions service available to that Google Cloud project. Google Maps is required in all panels and apps, with no alternative map, search or routing provider. Missing keys or Google failures show an error and retry. Street View appears only where Google has imagery; unavailable imagery and route errors are explained in the map.

Google login uses the installed native Google Sign-In SDK and server verification of the Google ID token. In Google Cloud, register the Android client for package `com.bingoor.shop` with the release signing certificate SHA-1 used by the APK build workflow. The Web OAuth client ID belongs in Admin → Login & Payments → Google. Include the website origin in the Web client's authorized JavaScript origins. Debug APKs require their own Android certificate registration.

Facebook and Instagram app login use the system browser, random state validation and a one-time code exchanged only by the backend. Add these exact HTTPS redirect URIs in the matching Meta applications:

- Facebook: `https://bingoor.com/auth/mobile/facebook`
- Instagram app: `https://bingoor.com/auth/mobile/instagram`
- Instagram website: `https://bingoor.com/auth/instagram`

Save the matching app IDs and secrets in Admin → Login & Payments and complete provider review/live-mode requirements. Instagram's current login API supports professional Business/Creator accounts, so this limitation is displayed beside login. Ordinary personal Instagram accounts must use another available login method. The Android app handles `bingoor://auth/facebook` and `bingoor://auth/instagram`; the HTTPS callback forwards only code/state, never account session tokens.

Provider references: [Google native sign-in](https://react-native-google-signin.github.io/docs/original), [Meta Instagram login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/), [Google Street View](https://developers.google.com/maps/documentation/javascript/streetview).

The Google site verification value supplied in the document is installed in the website root metadata. Publish the website before asking Search Console to verify ownership.

Customer flow: allow location permission, adjust the delivery pin, confirm it, complete receiver/address details and save. New addresses default to the selected delivery address. Saved addresses can be edited or selected with “Deliver here”. Orders keep their own address snapshot; changing a saved address affects future orders. Cart quantities update immediately, writes run sequentially, failures reconcile to the last confirmed basket, and checkout waits for outstanding writes.

Rider flow: accepting an order opens the active delivery map with the warehouse pickup and customer doorstep, with pickup navigation and delivery directions. The existing location watcher reports the rider position while the app is open and location permission/GPS are enabled. Customer tracking and the admin order detail refresh every 10 seconds. This change does not add an Android background location service: tracking while the rider app is suspended must be tested separately and requires additional native work if it is needed.

Before rollout, test provider sign-in on the release-signed APK, GPS permission denial, moving/saving a pin, selecting another saved address at checkout, slow and failed cart writes, two active rider orders, an area without Street View, and an actual rider-to-customer trip. No production credentials or accounts are supplied by this change.
