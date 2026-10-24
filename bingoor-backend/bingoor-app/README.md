# Bingoor - Customer App (React Native + Expo)

Screens: **Login**, **Signup**, **Dashboard** (categories, popular products, new arrivals, shops, product search).
Talks to the `bingoor-backend` public-portal API.

## Run

```bash
npm install
copy .env.example .env      # Windows (use `cp` on Mac/Linux) - then set EXPO_PUBLIC_API_URL
npx expo start
```

Scan the QR code with **Expo Go** on your phone, or press `a` for the Android emulator.

## Backend URL (important)

| Where you run the app | Set `EXPO_PUBLIC_API_URL` to |
|---|---|
| Android emulator | `http://10.0.2.2:5000/api/v1` (default, nothing to set) |
| Real phone (Expo Go) | `http://<your-PC-IP>:5000/api/v1`, e.g. `http://192.168.1.5:5000/api/v1` |
| iOS simulator / web | `http://localhost:5000/api/v1` (default) |

For a real phone: PC and phone on the same Wi-Fi, find the PC IP with `ipconfig` (IPv4 Address),
and allow port 5000 through Windows Firewall. Restart `npx expo start` after changing `.env`.

Start the backend first (`npm run dev` in `bingoor-backend`, after `npm run seed` for demo data).
Demo login: `9876543210` / `Customer@123`.

## Structure

```
App.tsx
src/
  config.ts        API URL
  theme.ts         colours, radius, shadows
  api/             axios client (auto token refresh), auth + catalog calls
  storage/         secure token storage
  context/         AuthContext (login state, restore session on app start)
  navigation/      Auth stack (Login, Signup) / App stack (Dashboard)
  components/      Button, TextField, AuthLayout, ProductCard, ShopCard
  screens/         LoginScreen, SignupScreen, DashboardScreen
```

## Notes

- Tokens are kept in the device's secure storage; the access token is refreshed automatically.
- Plain `http://` API URLs work in Expo Go. For a production Android build use `https://`.
- Not built yet: product detail, cart, checkout, orders, profile/addresses.
