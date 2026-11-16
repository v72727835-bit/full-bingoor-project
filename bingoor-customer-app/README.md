# Bingoor - Customer App (React Native CLI, Android)

Real React Native project (no Expo). Screens: **Login**, **Signup**, **Dashboard**.
Talks to the `bingoor-backend` API.

## One-time setup (Windows)

1. **Node.js 22 or newer**, **JDK 17**, **Android Studio** (with Android SDK + an emulator).
2. Environment variables:
   - `ANDROID_HOME` = `C:\Users\<you>\AppData\Local\Android\Sdk`
   - add `%ANDROID_HOME%\platform-tools` to `Path`
3. Keep the project path short. If the Android build fails with "path too long", move this
   folder to something like `C:\bingoor-mobile`.

## Run

```bash
npm install
npm start            # Metro bundler (keep this terminal open)
npm run android      # second terminal: builds and installs the app on the emulator/phone
```

Or open the `android` folder in Android Studio (**File -> Open -> bingoor-mobile\android**),
wait for Gradle sync, pick a device at the top and press Run.

Backend first: in `bingoor-backend` run `npm run seed` then `npm run dev`.
Demo login: `9876543210` / `Customer@123`.

## Backend URL

Edit `src/config.ts`:

| Where you run | What to do |
|---|---|
| Android emulator | nothing (uses `http://10.0.2.2:5000/api/v1`) |
| Phone on USB | run `adb reverse tcp:5000 tcp:5000`, set `API_URL_OVERRIDE = 'http://localhost:5000/api/v1'` |
| Phone on Wi-Fi | set `API_URL_OVERRIDE = 'http://<PC-IP>:5000/api/v1'` and allow port 5000 in Windows Firewall |

Debug builds allow plain `http://`. A release build needs an `https://` API.

## Build an APK

```bash
cd android
gradlew assembleDebug        # -> android\app\build\outputs\apk\debug\app-debug.apk
```

For a Play Store / release build you must create a signing keystore first
(https://reactnative.dev/docs/signed-apk-android).

## Structure

```
App.tsx
src/
  config.ts        API URL
  api/             axios client (auto token refresh), auth + catalog calls
  storage/         tokens in Android Keystore (react-native-keychain)
  context/         AuthContext
  navigation/      Auth stack (Login, Signup) / App stack (Dashboard)
  components/      Button, TextField, AuthLayout, ProductCard, ShopCard
  screens/         LoginScreen, SignupScreen, DashboardScreen
android/           native Android project (open this in Android Studio)
__tests__/         unit tests (npm test)
```

Not built yet: product detail, cart, checkout, orders, profile/addresses. iOS folder is not included.
