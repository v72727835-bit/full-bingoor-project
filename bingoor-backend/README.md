# Bingoor Backend - Public (Customer) Portal API

Node.js + Express + TypeScript + MongoDB (Mongoose). This covers **only the public/customer portal**.
Rider, Shop and Admin portals will be added on top of the same models later.

## Quick start

```bash
npm install
cp .env.example .env        # then edit MONGO_URI and the two JWT secrets
npm run seed                # optional: demo categories, shops, products, a demo customer
npm run dev                 # http://localhost:5000
```

Production: `npm run build && npm start`.

Demo login after seeding: phone `9876543210`, password `Customer@123`.
Sample coordinates for location tests: `lat=24.6905&lng=83.0687`.

> `npm run seed` **wipes** users, categories, shops, products, carts, orders and reviews in the database it points to. Use a dev DB.

## Response format

```json
{ "success": true, "data": { }, "meta": { "page": 1, "limit": 20, "total": 57, "totalPages": 3, "hasNext": true } }
{ "success": false, "message": "Validation failed", "details": { "phone": ["Enter a valid 10-digit mobile number"] } }
```

Protected routes need `Authorization: Bearer <accessToken>`.
Access token lives 15 min; use `/auth/refresh` with the refresh token (rotated on every use, up to 5 devices).

## Endpoints (base: `/api/v1`)

### Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | `{ name, phone, email?, password }` -> user + tokens |
| POST | `/auth/login` | `{ identifier (phone or email), password }` |
| POST | `/auth/refresh` | `{ refreshToken }` -> new token pair |
| POST | `/auth/logout` | login needed. Body `{ refreshToken }` = this device, empty = all devices |
| POST | `/auth/change-password` | `{ currentPassword, newPassword }` |

### Browse (no login)
| Method | Path | Notes |
|---|---|---|
| GET | `/home` | `?lat&lng` -> categories, popular, new arrivals, nearby shops |
| GET | `/categories` | top-level with `children`; `?parent=<id>` or `?all=true` |
| GET | `/shops` | `?lat&lng&radiusKm=10&q&isOpen&page&limit` (nearest first when lat/lng sent) |
| GET | `/shops/:idOrSlug` | shop details + categories it sells in |
| GET | `/products` | `?q&category&shop&minPrice&maxPrice&inStock&sort&page&limit` |
| GET | `/products/suggest?q=` | search-box suggestions |
| GET | `/products/:idOrSlug` | detail + related products |
| GET | `/products/:id/reviews` | list + star breakdown |

`sort` = `relevance | popular | newest | price_asc | price_desc | rating`. `category` may be a parent category (includes sub-categories).

### Customer (login needed)
| Method | Path | Notes |
|---|---|---|
| GET / PATCH | `/me` | profile (`name`, `email`, `avatar`) |
| GET / POST | `/me/addresses` | up to 10 saved addresses |
| PATCH / DELETE | `/me/addresses/:addressId` | |
| PATCH | `/me/addresses/:addressId/default` | |
| GET | `/me/wishlist` | |
| POST / DELETE | `/me/wishlist/:productId` | |
| PUT | `/products/:id/reviews` | `{ rating 1-5, comment? }` - only after a delivered order containing it |
| DELETE | `/reviews/:id` | own review |

### Cart (login needed)
| Method | Path | Notes |
|---|---|---|
| GET | `/cart` | grouped by shop, per-shop delivery fee, item issues, totals |
| POST | `/cart/items` | `{ productId, quantity }` (adds to existing, clamped to stock, max 20) |
| PATCH | `/cart/items/:productId` | `{ quantity }` (0 removes) |
| DELETE | `/cart/items/:productId` | |
| DELETE | `/cart` | clear |

### Orders (login needed)
| Method | Path | Notes |
|---|---|---|
| POST | `/orders` | `{ addressId, paymentMethod: "cod"\|"online", note? }` |
| GET | `/orders` | `?status&active=true&page&limit` |
| GET | `/orders/:id` | full details, status history, delivery OTP, rider (once out for delivery) |
| POST | `/orders/:id/cancel` | `{ reason? }` - only while `placed` or `accepted` |
| POST | `/orders/:id/reorder` | puts the items back in the cart, returns `skipped` names |

**Multi-shop carts:** checkout creates **one order per shop** (all share a `checkoutId`), each with its own delivery fee.
**Delivery fee:** shop's `deliveryFee`, free when that shop's subtotal >= `FREE_DELIVERY_ABOVE`.
**Checks at checkout:** shop open, product active, stock available, shop minimum order, and delivery radius (when the address has coordinates).
**Stock:** reserved atomically per product at checkout, released if anything fails or the customer cancels.
**Order status flow:** `placed -> accepted -> preparing -> ready_for_pickup -> out_for_delivery -> delivered` (or `cancelled` / `rejected`). Shop and rider portals will drive these transitions.

## Project layout

```
src/
  config/        env + database
  models/        User, Category, Shop, Product, Cart, Order, Review
  validators/    zod schemas for every request
  middleware/    auth (JWT + roles), validation, error handling
  controllers/   auth, user, catalog, review, cart, order
  services/      cart resolution + totals (shared by cart and checkout)
  routes/        all public-portal routes
  seed.ts        demo data
```

## Known gaps / next steps

- **Online payment:** `paymentMethod: "online"` creates the order with `paymentStatus: "pending"`; no gateway is wired yet (Razorpay is the usual choice in India).
- **OTP login:** currently phone/email + password. OTP needs an SMS provider (MSG91, Twilio, ...).
- **Coupons/offers, push notifications, image upload:** not included.
- **Transactions:** stock reservation uses atomic per-product updates with manual rollback, so it also works on a standalone MongoDB. On a replica set you can swap this for a real transaction.
- **Deactivating a shop** should also hide its products (do this in the shop/admin portal), because product listing filters on the product's own `isActive`.
