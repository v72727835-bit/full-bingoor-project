import { z } from 'zod';
import { FACEBOOK_APP_ID, GOOGLE_CLIENT_ID, INSTAGRAM_APP_ID } from '../utils/socialIds';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

/** Indian mobile number. Accepts +91 / 91 prefix, spaces and dashes; stores 10 digits. */
export const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, '').replace(/^(\+91|91)(?=\d{10}$)/, ''))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'));

const password = z.string().min(6, 'Password must be at least 6 characters').max(72);
const boolFromQuery = z.enum(['true', 'false']).transform((v) => v === 'true');

/* ---------- common ---------- */
export const idParam = z.object({ id: objectId });
export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/* ---------- auth ---------- */
export const registerBody = z.object({
  name: z.string().trim().min(2).max(80),
  phone,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  password,
});

export const loginBody = z.object({
  identifier: z.string().trim().min(3), // phone or email
  password: z.string().min(1),
});


export const refreshBody = z.object({ refreshToken: z.string().min(10) });

export const deleteMeBody = z.object({ password: z.string().min(1, 'Enter your password to confirm') });

export const changePasswordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: password,
});

/* ---------- profile / addresses ---------- */
export const updateProfileBody = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().toLowerCase().email(),
    avatar: z.string().url(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

const addressFields = {
  label: z.enum(['home', 'work', 'other']).default('home'),
  name: z.string().trim().min(2).max(80),
  phone,
  // A flat / house number can be as short as "15" or "B2".
  line1: z.string().trim().min(1, 'Please enter your flat / house number').max(200),
  line2: z.string().trim().max(200).optional(),
  landmark: z.string().trim().max(100).optional(),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
  location: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .optional(),
  isDefault: z.boolean().optional(),
};
export const addressBody = z.object(addressFields);
export const addressUpdateBody = z
  .object(addressFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export const addressIdParam = z.object({ addressId: objectId });
export const productIdParam = z.object({ productId: objectId });

/* ---------- catalog ---------- */
export const geoQuery = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export const homeQuery = geoQuery.refine((v) => (v.lat === undefined) === (v.lng === undefined), {
  message: 'Send both lat and lng, or neither',
});

export const coverageQuery = z.object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180) });

export const categoriesQuery = z.object({
  parent: objectId.optional(),
  level: z.coerce.number().int().min(1).max(3).optional(),
  all: boolFromQuery.optional(), // all=true -> flat list of every level
});

export const shopsQuery = pagination
  .merge(geoQuery)
  .extend({
    radiusKm: z.coerce.number().min(1).max(100).default(10),
    q: z.string().trim().max(60).optional(),
    isOpen: boolFromQuery.optional(),
  })
  .refine((v) => (v.lat === undefined) === (v.lng === undefined), {
    message: 'Send both lat and lng, or neither',
  });

export const PRODUCT_SORTS = ['relevance', 'newest', 'price_asc', 'price_desc', 'popular', 'rating', 'name'] as const;

export const productsQuery = pagination.extend({
  q: z.string().trim().max(60).optional(),
  category: z.string().trim().optional(), // id or slug
  shop: z.string().trim().optional(), // id or slug
  brand: z.string().trim().max(60).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  inStock: boolFromQuery.optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  minDiscount: z.coerce.number().min(0).max(100).optional(),
  foodType: z.enum(['veg', 'nonveg']).optional(),
  sort: z.enum(PRODUCT_SORTS).default('relevance'),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export const suggestQuery = z.object({
  q: z.string().trim().min(1).max(60),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export const idOrSlugParam = z.object({ idOrSlug: z.string().trim().min(1).max(120) });

/* ---------- reviews ---------- */
export const reviewBody = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

/* ---------- cart ---------- */
export const addCartItemBody = z.object({
  productId: objectId,
  quantity: z.number().int().min(1).max(20).default(1),
});
export const updateCartItemBody = z.object({ quantity: z.number().int().min(0).max(20) });

/* ---------- orders ---------- */
export const placeOrderBody = z.object({
  addressId: objectId,
  paymentMethod: z.enum(['cod', 'online']).default('cod'),
  /** Which online way to pay; each has its own charge (#36). Ignored for COD. */
  payOption: z.enum(['upi', 'debit', 'netbanking', 'credit', 'rupay']).optional(),
  /** #35: a thank-you for the delivery partner, paid with the order. All of it goes to the rider. */
  tip: z.coerce.number().int().min(0).max(500).default(0),
  note: z.string().trim().max(300).optional(),
  slot: z.enum(['instant', 'twoHour', 'nextDay']).default('instant'),
});

export const socialLoginBody = z.object({ accessToken: z.string().min(10).max(4000) });
/** Instagram hands the website a one-time code; the server swaps it (with the app secret) for the customer's id. */
export const googleLoginBody = z.union([socialLoginBody, z.object({ idToken: z.string().min(10).max(8000) })]);
export const facebookLoginBody = z.union([socialLoginBody, z.object({
  code: z.string().min(10).max(2000),
  redirectUri: z.literal('https://bingoor.com/auth/mobile/facebook'),
})]);
export const instagramLoginBody = z.object({ code: z.string().min(10).max(2000), redirectUri: z.string().url().max(500) });

export const confirmPaymentBody = z.object({
  razorpay_order_id: z.string().min(5).max(80),
  razorpay_payment_id: z.string().min(5).max(80),
  razorpay_signature: z.string().min(10).max(200),
});

export const ordersQuery = pagination.extend({
  status: z
    .enum(['placed', 'accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'cancelled', 'rejected'])
    .optional(),
  active: boolFromQuery.optional(), // active=true -> only in-progress orders
});

export const cancelOrderBody = z.object({ reason: z.string().trim().max(200).optional() });
export const riderOrdersQuery = pagination.extend({
  status: z.enum(['ready_for_pickup', 'out_for_delivery', 'delivered']).optional(),
});

export const walletAccountBody = z.object({
  upi: z.string().trim().max(80).optional().or(z.literal('')),
  bankHolder: z.string().trim().max(80).optional().or(z.literal('')),
  bankNumber: z.string().trim().max(30).optional().or(z.literal('')),
  bankIfsc: z.string().trim().toUpperCase().max(15).optional().or(z.literal('')),
});
export const withdrawBody = z.object({ amount: z.coerce.number().positive().max(1_000_000), method: z.enum(['upi', 'bank']) });
export const cashSubmitBody = z.object({ amount: z.coerce.number().min(0).max(1_000_000).optional(), note: z.string().trim().max(200).optional() });
export const walletTxnsQuery = pagination.extend({ kind: z.enum(['earning', 'bonus', 'adjustment', 'withdrawal', 'cash_submit']).optional() });
export const withdrawalsQuery = pagination.extend({ status: z.enum(['pending', 'paid', 'rejected', 'all']).optional() });
export const markWithdrawalBody = z.object({ status: z.enum(['paid', 'rejected']), reference: z.string().trim().max(120).optional() });
export const walletAdjustBody = z.object({ amount: z.coerce.number().positive().max(1_000_000), note: z.string().trim().max(200).optional() });
export const riderLocationBody = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const riderDeliveryBody = z.object({ otp: z.string().trim().regex(/^\d{4}$/, 'Enter the 4-digit delivery OTP').optional(), direct: z.coerce.boolean().optional() }).refine((b) => !!b.otp || b.direct, { message: 'Enter the 4-digit delivery OTP' });

/* ---------- admin ---------- */
export const adminLoginBody = z.object({
  identifier: z.string().trim().min(3),
  password: z.string().min(1),
});

/** A GST rate (%), or null to go back to the shop-wide default. */
const gstRateField = z.preprocess((v) => (v === '' ? undefined : v), z.union([z.null(), z.coerce.number().min(0).max(28)]).optional());

const paymentModeField = z.enum(['both', 'cod', 'online']);

const geoPoint = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

export const adminProductBody = z.object({
  shop: objectId,
  category: objectId,
  name: z.string().trim().min(2).max(150),
  brand: z.string().trim().max(60).optional(),
  description: z.string().trim().max(20000).optional(),
  images: z.array(z.string().url()).max(10).default([]),
  video: z.string().trim().url('The video must be a full link').max(500).optional().or(z.literal('')),
  icon: z.string().trim().max(80).optional(),
  price: z.number().min(0),
  mrp: z.number().min(0),
  unit: z.string().trim().min(1).max(30).default('1 pc'),
  stock: z.number().int().min(0).default(0),
  attributes: z.array(z.string().trim().max(40)).max(10).default([]),
  foodType: z.enum(['veg', 'nonveg', '']).default(''),
  tags: z.array(z.string().trim().max(40)).max(10).default([]),
  hsn: z.string().trim().max(10).optional().or(z.literal('')),
  gstRate: gstRateField,
  paymentMode: paymentModeField.default('both'),
  isActive: z.boolean().default(true),
  ratingLabel: z.string().trim().max(20).optional(),
  /** Star rating (0-5) and number of ratings shown on the card and product page. */
  rating: z.coerce.number().min(0).max(5).optional(),
  ratingCount: z.coerce.number().int().min(0).optional(),
  variantGroup: z.string().trim().max(60).optional(),
  variantLabel: z.string().trim().max(30).optional(),
  nameHi: z.string().trim().max(150).optional(),
  /** Hidden cart-points value (0-50) for this size; never shown to customers. */
  points: z.coerce.number().int().min(0).max(50).optional(),
  /** Admin tick: include this product in the cart / checkout top-up (50-point) list. */
  cartFeatured: z.coerce.boolean().optional(),
  dealOfDay: z.coerce.boolean().optional(),
  /** Admin-only ordering; lower comes first. Empty = alphabetical. */
  sortCode: z.preprocess((v) => (v === null || v === '' ? 1_000_000 : v), z.coerce.number().int().min(0).max(1_000_000)).optional(),
  /** Home-screen rows (Standard categories) this product is shown in. */
  standardCategories: z.array(objectId).max(10).optional(),
});
export const adminProductUpdateBody = adminProductBody.partial();

export const adminProductsQuery = pagination.extend({
  q: z.string().trim().max(60).optional(),
  category: objectId.optional(),
  shop: objectId.optional(),
  isActive: boolFromQuery.optional(),
  /** Every size of one item (the product form's "Sizes of this product"). */
  variantGroup: z.string().trim().toLowerCase().max(60).optional(),
});

export const adminCategoryBody = z.object({
  name: z.string().trim().min(1).max(80),
  nameHi: z.string().trim().max(80).optional(),
  parent: objectId.nullable().default(null),
  level: z.coerce.number().int().min(1).max(3),
  icon: z.string().trim().max(80).optional(),
  image: z.string().trim().max(300).optional(),
  tint: z.string().trim().max(20).optional(),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});
export const adminCategoryUpdateBody = z
  .object({
    name: z.string().trim().min(1).max(80),
    nameHi: z.string().trim().max(80),
    parent: objectId.nullable(),
    icon: z.string().trim().max(80),
    image: z.string().trim().max(300),
    tint: z.string().trim().max(20),
    sortOrder: z.coerce.number().int(),
    isActive: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const adminShopBody = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  logo: z.string().trim().max(300).optional(),
  banner: z.string().trim().max(300).optional(),
  phone: z.string().trim().max(20).optional(),
  address: z.object({
    line1: z.string().trim().max(200).optional(),
    city: z.string().trim().max(60).optional(),
    state: z.string().trim().max(60).optional(),
    pincode: z.string().trim().max(10).optional(),
  }).default({}),
  location: geoPoint.default({ lat: 24.7, lng: 83.07 }), // Robertsganj, Sonbhadra
  isOpen: z.boolean().default(true),
  isActive: z.boolean().default(true),
  deliveryRadiusKm: z.number().finite().min(1).default(10),
  minOrderAmount: z.number().min(0).default(0),
  deliveryFee: z.number().min(0).default(30),
  gstin: z.string().trim().toUpperCase().max(15).optional().or(z.literal('')),
});
export const adminShopUpdateBody = adminShopBody.partial();

export const adminOrderStatusBody = z.object({
  status: z.enum(['placed', 'accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'cancelled', 'rejected']),
  note: z.string().trim().max(300).optional(),
});

export const adminOrdersQuery = pagination.extend({
  rider: z.string().trim().max(60).optional(),
  status: z
    .enum(['placed', 'accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'cancelled', 'rejected'])
    .optional(),
  q: z.string().trim().max(60).optional(),
});

export const adminUsersQuery = pagination.extend({
  role: z.enum(['customer', 'rider', 'shop', 'admin', 'seller']).optional(),
  q: z.string().trim().max(60).optional(),
});

export const adminUserUpdateBody = z
  .object({
    isActive: z.boolean(),
    role: z.enum(['customer', 'rider', 'shop', 'admin', 'seller']),
    warehouse: objectId.nullable(),
    warehouses: z.array(objectId).min(1, 'Choose at least one warehouse').max(30),
    name: z.string().trim().min(2).max(80),
    phone,
    email: z.string().trim().toLowerCase().email().or(z.literal('')),
    /** A new password the admin sets for the person (they are signed out everywhere). */
    password: z.string().min(6, 'Password must be at least 6 characters').max(72),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const adminRiderBody = z
  .object({
    name: z.string().trim().min(2).max(80),
    phone,
    email: z.string().trim().toLowerCase().email().optional().or(z.literal('').transform(() => undefined)),
    password: password,
    /** One or more warehouses the rider delivers for (`warehouse` still works for old clients). */
    warehouses: z.array(objectId).min(1, 'Choose at least one warehouse').max(30).optional(),
    warehouse: objectId.optional(),
    /** Special rider who gets the orders beyond the normal radius (point 41). */
    longDistance: z.boolean().optional(),
  })
  .refine((v) => (v.warehouses?.length ?? 0) > 0 || !!v.warehouse, { message: 'Choose at least one warehouse', path: ['warehouses'] });

/* ---------- admin: banners ---------- */

export const adminBannerBody = z.object({
  title: z.string().trim().max(80).optional(),
  subtitle: z.string().trim().max(140).optional(),
  cta: z.string().trim().max(30).optional(),
  image: z.string().trim().min(1, 'Upload a banner image').max(300),
  category: objectId.nullable().default(null),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});
export const adminBannerUpdateBody = z
  .object({
    title: z.string().trim().max(80),
    subtitle: z.string().trim().max(140),
    cta: z.string().trim().max(30),
    image: z.string().trim().min(1).max(300),
    category: objectId.nullable(),
    sortOrder: z.coerce.number().int(),
    isActive: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

/* ---------- admin: coupons & account ---------- */

export const adminCouponBody = z.object({
  code: z.string().trim().min(3).max(24).transform((s) => s.toUpperCase()),
  description: z.string().trim().max(200).optional(),
  discountType: z.enum(['percent', 'flat']).default('percent'),
  value: z.coerce.number().min(0),
  maxDiscount: z.coerce.number().min(0).default(0),
  minOrderAmount: z.coerce.number().min(0).default(0),
  startsAt: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  usageLimit: z.coerce.number().int().min(0).default(0),
  perUserLimit: z.coerce.number().int().min(0).default(1),
  shops: z.array(objectId).default([]),
  isActive: z.boolean().default(true),
});
export const adminCouponUpdateBody = adminCouponBody.partial().refine(
  (v) => Object.keys(v).length > 0,
  'Nothing to update',
);

export const adminCouponsQuery = pagination.extend({
  q: z.string().trim().max(40).optional(),
  isActive: z.coerce.boolean().optional(),
});

export const adminStatsQuery = z.object({
  days: z.coerce.number().int().min(7).max(90).optional(),
});

export const adminProfileBody = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email().max(120),
    phone: z.string().trim().min(10).max(15),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const adminPasswordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(72),
});

/* ---------- settings, notices, care chat, stock alerts, riders ---------- */

export const adminSettingsBody = z
  .object({
    festival: z
      .object({
        enabled: z.boolean(),
        name: z.string().trim().min(1).max(30),
        banner: z.string().trim().max(300),
        sections: z.array(z.object({ title: z.string().trim().max(60), category: objectId })).max(20),
      })
      .partial(),
    sixDay: z.object({ days: z.coerce.number().int().min(1).max(60), categories: z.array(objectId).max(100) }).partial(),
        popup: z.object({ enabled: z.boolean(), intervalSeconds: z.coerce.number().int().min(15).max(3600), pages: z.array(z.object({ image: z.string().trim().max(500), link: z.string().trim().max(500).optional().or(z.literal('')) })).max(30) }).partial(),
    cod: z.object({ disabledCategories: z.array(objectId).max(100), message: z.string().trim().max(300), cutoffEnabled: z.boolean(), cutoffTime: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/), cutoffMessage: z.string().trim().max(200) }).partial(),
    riderCodLimit: z.coerce.number().min(0).max(1_000_000),
    riderPay: z
      .object({
        enabled: z.boolean(),
        baseFare: z.coerce.number().min(0).max(10_000),
        slabs: z.array(z.object({ maxKm: z.coerce.number().min(0).max(500), pay: z.coerce.number().min(0).max(100_000) })).max(20),
        perKmBeyond: z.coerce.number().min(0).max(10_000),
        minPerOrder: z.coerce.number().min(0).max(100_000),
        minWithdraw: z.coerce.number().min(0).max(100_000),
      })
      .partial(),
    sellerPay: z
      .object({
        commissionPct: z.coerce.number().min(0).max(100),
        minWithdraw: z.coerce.number().min(0).max(1_000_000),
      })
      .partial(),
    appLinks: z
      .object({ android: z.string().trim().max(500), ios: z.string().trim().max(500), rider: z.string().trim().max(500), warehouse: z.string().trim().max(500) })
      .partial(),
    gst: z.object({ defaultRate: z.coerce.number().min(0).max(28), deliveryRate: z.coerce.number().min(0).max(28), homeState: z.string().trim().max(60) }).partial(),
    company: z
      .object({
        name: z.string().trim().max(80), tagline: z.string().trim().max(120), address: z.string().trim().max(300), phone: z.string().trim().max(30),
        email: z.string().trim().max(120), website: z.string().trim().max(200), gstin: z.string().trim().max(20), fssai: z.string().trim().max(20),
        logo: z.string().trim().max(500), signature: z.string().trim().max(500), seal: z.string().trim().max(500),
        signatoryName: z.string().trim().max(80), signatoryTitle: z.string().trim().max(80), declaration: z.string().trim().max(600), footerNote: z.string().trim().max(300),
      })
      .partial(),
    socialOther: z.array(z.object({ label: z.string().trim().min(1).max(30), url: z.string().trim().max(300).refine((u) => /^https?:\/\//i.test(u), 'Enter the full link, starting with https://') })).max(12),
    socialLinks: z
      .object(Object.fromEntries(['facebook', 'instagram', 'youtube', 'whatsapp', 'x', 'telegram', 'linkedin'].map((k) => [k, z.string().trim().max(300).refine((u) => u === '' || /^https?:\/\//i.test(u), 'Enter the full link, starting with https://')])) as Record<'facebook' | 'instagram' | 'youtube' | 'whatsapp' | 'x' | 'telegram' | 'linkedin', z.ZodEffects<z.ZodString, string, string>>)
      .partial(),
    imageMaxKb: z.coerce.number().int().min(20).max(5000),
    supportPhone: z.string().trim().max(20),
    deliverySlots: z
      .array(z.object({ key: z.enum(['instant', 'twoHour', 'nextDay']), label: z.string().trim().min(1).max(30), enabled: z.boolean() }))
      .max(3),
    twoHourCharge: z.object({ enabled: z.boolean(), amount: z.coerce.number().min(0).max(1000) }).partial(),
    pricing: z
      .object({
        handlingFee: z.coerce.number().min(0).max(500),
        bands: z
          .array(
            z.object({
              upToKm: z.coerce.number().min(1).max(500),
              minOrder: z.coerce.number().min(0).max(100000),
              freeAbove: z.coerce.number().min(0).max(100000),
              fee: z.coerce.number().min(0).max(1000),
              nextDay: z.boolean().default(false),
              redOrder: z.boolean().default(false),
            }),
          )
          .max(10),
        beyondDays: z.coerce.number().int().min(1).max(30),
        beyondMinOrder: z.coerce.number().min(0).max(100000),
        beyondCodDisabled: z.coerce.boolean(),
        beyondCodMessage: z.string().trim().min(1).max(200),
        beyondCategories: z.array(objectId).max(300),
        beyondStandardCategories: z.array(objectId).max(100),
        beyondProducts: z.array(objectId).max(500),
      })
      .partial(),
    filters: z
      .array(
        z.object({
          key: z.string().trim().min(1).max(30),
          label: z.string().trim().min(1).max(30),
          kind: z.enum(['brand', 'price', 'discount', 'rating', 'diet', 'stock']),
          enabled: z.boolean(),
        }),
      )
      .max(20),
    priceSortEnabled: z.boolean(),
    googleReviewUrl: z.string().trim().max(500),
    cartPoints: z
      .object({ enabled: z.boolean(), target: z.coerce.number().int().min(1).max(5000), suggestions: z.array(objectId).max(60) })
      .partial(),
    paymentOptions: z
      .array(
        z.object({
          key: z.enum(['upi', 'cod', 'debit', 'netbanking', 'credit', 'rupay']),
          label: z.string().trim().min(1).max(40),
          note: z.string().trim().max(200).optional(),
          enabled: z.boolean(),
          pct: z.coerce.number().min(0).max(10),
          highPct: z.coerce.number().min(0).max(10).optional(),
          highFrom: z.coerce.number().min(0).max(10000000).optional(),
        }),
      )
      .max(6),
  })
  .partial();

export const noticeBody = z.object({ message: z.string().trim().min(1).max(500) });

const indianPhone = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s-]/g, '').replace(/^(\+91|91)(?=\d{10}$)/, ''))
  .refine((s) => /^[6-9]\d{9}$/.test(s), 'Enter a valid 10-digit mobile number');

export const notifyMeBody = z.object({ phone: indianPhone });
export const ticketBody = z.object({ query: z.string().trim().min(3).max(1000), phone: indianPhone });
export const ticketMessageBody = z.object({ text: z.string().trim().min(1).max(1000) });
export const ticketStatusBody = z.object({ status: z.enum(['open', 'closed']) });
export const adminTicketsQuery = pagination.extend({ status: z.enum(['open', 'closed']).optional() });
export const stockAlertUpdateBody = z.object({ notified: z.boolean() });
export const adminRidersQuery = z.object({ q: z.string().trim().max(60).optional(), online: boolFromQuery.optional() });
export const riderPauseBody = z.object({ paused: z.boolean() });

/* ---------- enquiry forms ---------- */
export const ENQUIRY_KINDS = ['city_manager', 'invest', 'delivery_partner', 'seller', 'advertise', 'complaint'] as const;
export const enquiryBody = z.object({
  kind: z.enum(ENQUIRY_KINDS),
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(120),
  mobile: indianPhone,
  otherPhone: z.string().trim().max(20).optional(),
  reason: z.string().trim().min(3).max(2000),
});
export const adminEnquiriesQuery = pagination.extend({ kind: z.enum(ENQUIRY_KINDS).optional() });
export const riderLongDistanceBody = z.object({ longDistance: z.boolean() });
export const guestCartBody = z.object({
  items: z.array(z.object({ productId: objectId, quantity: z.number().int().min(1).max(20) })).max(100).default([]),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  slot: z.enum(['instant', 'twoHour', 'nextDay']).default('instant'),
});

export const quoteQuery = z.object({
  addressId: z.string().trim().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  slot: z.enum(['instant', 'twoHour', 'nextDay']).default('instant'),
  paymentMethod: z.enum(['cod', 'online']).default('cod'),
});

/* ---------- sellers ---------- */
export const sellerProfileBody = z.object({
  firm: z.string().trim().min(2).max(120),
  address: z.string().trim().min(5).max(300),
  mobile: indianPhone,
  aadhaar: z.string().trim().regex(/^\d{12}$/, 'Aadhaar must be 12 digits').optional().or(z.literal('').transform(() => undefined)),
  pan: z.string().trim().toUpperCase().regex(/^[A-Z]{5}\d{4}[A-Z]$/, 'Enter a valid PAN').optional().or(z.literal('').transform(() => undefined)),
  bankName: z.string().trim().min(2).max(80),
  accountNumber: z.string().trim().regex(/^\d{6,20}$/, 'Enter a valid account number'),
  accountType: z.enum(['current', 'savings']),
  ifsc: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Enter a valid IFSC code'),
});
export const sellerProductBody = z.object({
  category: objectId,
  warehouse: objectId.optional(),
  name: z.string().trim().min(2).max(150),
  nameHi: z.string().trim().max(150).optional(),
  brand: z.string().trim().max(60).optional(),
  description: z.string().trim().max(20000).optional(),
  images: z.array(z.string().url()).max(10).default([]),
  video: z.string().trim().url('The video must be a full link').max(500).optional().or(z.literal('')),
  price: z.number().min(0),
  mrp: z.number().min(0),
  unit: z.string().trim().min(1).max(30).default('1 pc'),
  stock: z.number().int().min(0).default(0),
  attributes: z.array(z.string().trim().max(40)).max(10).default([]),
  foodType: z.enum(['veg', 'nonveg', '']).default(''),
  tags: z.array(z.string().trim().max(40)).max(15).default([]),
  variantGroup: z.string().trim().max(60).optional(),
  variantLabel: z.string().trim().max(30).optional(),
  hsn: z.string().trim().max(10).optional().or(z.literal('')),
  gstRate: gstRateField,
  paymentMode: paymentModeField.default('both'),
});
export const sellerProductUpdateBody = z
  .object({
    stock: z.number().int().min(0),
    isActive: z.boolean(),
    price: z.number().min(0),
    mrp: z.number().min(0),
    name: z.string().trim().min(2).max(150),
    nameHi: z.string().trim().max(150),
    brand: z.string().trim().max(60),
    description: z.string().trim().max(2000),
    unit: z.string().trim().min(1).max(30),
    images: z.array(z.string().url()).max(10),
    video: z.string().trim().url('The video must be a full link').max(500).optional().or(z.literal('')),
    category: objectId,
    foodType: z.enum(['veg', 'nonveg', '']),
    attributes: z.array(z.string().trim().max(40)).max(10),
    tags: z.array(z.string().trim().max(40)).max(15),
    variantGroup: z.string().trim().max(60),
    variantLabel: z.string().trim().max(30),
    hsn: z.string().trim().max(10),
    gstRate: gstRateField,
    paymentMode: paymentModeField,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export const adminSellerBody = z.object({
  name: z.string().trim().min(2).max(80),
  phone,
  email: z.string().trim().toLowerCase().email().optional().or(z.literal('').transform(() => undefined)),
  password: password,
  warehouses: z.array(objectId).min(1, 'Select at least one warehouse').max(50),
  kind: z.enum(['warehouse', 'product']).default('warehouse'),
});
export const sellerWarehousesBody = z.object({ warehouses: z.array(objectId).min(1, 'Select at least one warehouse').max(50) });
export const assignRiderBody = z.object({ rider: objectId });
export const sellerOrderStatusBody = z.object({
  status: z.enum(['accepted', 'rejected', 'preparing', 'ready_for_pickup', 'cancelled']),
  note: z.string().trim().max(300).optional(),
});
export const sellerOrdersQuery = pagination.extend({
  q: z.string().trim().max(40).optional(),
  status: z.enum(['placed', 'accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'cancelled', 'rejected']).optional(),
});
export const adminSellersQuery = pagination.extend({ q: z.string().trim().max(60).optional(), kind: z.enum(['warehouse', 'product']).optional() });
export const activeBody = z.object({ isActive: z.boolean() });

export const warehouseLoginBody = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone,
  password: password.optional(),
  isActive: z.boolean().optional(),
});
export const sellerRiderBody = z.object({
  name: z.string().trim().min(2).max(80),
  phone,
  password: password,
  warehouse: objectId.optional(),
  warehouses: z.array(objectId).min(1).max(30).optional(),
});

export const standardCategoryBody = z.object({
  name: z.string().trim().min(2).max(60),
  nameHi: z.string().trim().max(60).optional(),
  position: z.enum(['top', 'bottom']).default('top'),
  sortOrder: z.coerce.number().int().min(0).max(100000).default(0),
  isActive: z.boolean().default(true),
});
export const standardCategoryUpdateBody = standardCategoryBody.partial();

/** Secrets are only changed when a new value is sent; `clear...` removes a saved one. */
export const integrationsBody = z.object({
  googleClientId: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === '' || GOOGLE_CLIENT_ID.test(v), {
      message: 'Google Client ID should end in .apps.googleusercontent.com. A value starting with GOCSPX- is the Client secret, not the ID.',
    })
    .optional(),
  facebookAppId: z
    .string()
    .trim()
    .max(100)
    .refine((v) => v === '' || FACEBOOK_APP_ID.test(v), { message: 'Facebook App ID is a number (e.g. 1234567890123456), not an email.' })
    .optional(),
  facebookAppSecret: z.string().trim().max(200).optional(),
  clearFacebookSecret: z.boolean().optional(),
  instagramAppId: z
    .string()
    .trim()
    .max(100)
    .refine((v) => v === '' || INSTAGRAM_APP_ID.test(v), { message: 'Instagram App ID is a number from the Meta developer app (Instagram > API setup with Instagram login).' })
    .optional(),
  instagramAppSecret: z.string().trim().max(200).optional(),
  clearInstagramSecret: z.boolean().optional(),
  razorpayKeyId: z.string().trim().max(100).optional(),
  razorpayKeySecret: z.string().trim().max(200).optional(),
  clearRazorpaySecret: z.boolean().optional(),
  razorpayWebhookSecret: z.string().trim().max(200).optional(),
  clearRazorpayWebhook: z.boolean().optional(),
  razorpayEnabled: z.boolean().optional(),
  googleMapsApiKey: z.string().trim().max(200).optional(),
  shiprocketEmail: z.string().trim().max(200).optional(),
  shiprocketPassword: z.string().trim().max(200).optional(),
  clearShiprocketPassword: z.boolean().optional(),
  shiprocketPickupLocation: z.string().trim().max(120).optional(),
  shiprocketChannelId: z.string().trim().max(60).optional(),
  shiprocketEnabled: z.boolean().optional(),
  razorpayxAccountNumber: z.string().trim().max(40).optional(),
  razorpayxKeyId: z.string().trim().max(100).optional(),
  razorpayxKeySecret: z.string().trim().max(200).optional(),
  clearRazorpayxSecret: z.boolean().optional(),
  razorpayxEnabled: z.boolean().optional(),
  razorpayxAutoPayout: z.boolean().optional(),
});

/* ---------- warehouse self-registration ---------- */
export const warehouseRegisterBody = z.object({
  name: z.string().trim().min(2).max(80),
  phone: indianPhone,
  email: z.string().trim().toLowerCase().email().max(120).optional(),
  password,
  shopName: z.string().trim().min(2).max(100),
  line1: z.string().trim().min(5).max(200),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Enter a 6-digit PIN code'),
  location: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
  gst: z.string().trim().max(20).optional(),
  note: z.string().trim().max(500).optional(),
});
export const warehouseApplicationsQuery = pagination.extend({ status: z.enum(['pending', 'approved', 'rejected']).optional() });
export const warehouseRejectBody = z.object({ reason: z.string().trim().min(3).max(300) });

/* ---------- warehouse panel ---------- */
export const sellerProductsQuery = pagination.extend({
  q: z.string().trim().max(60).optional(),
  status: z.enum(['live', 'off', 'out', 'low']).optional(),
  category: objectId.optional(),
});
export const sellerShopBody = z
  .object({
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(500),
    phone: z.string().trim().max(20),
    logo: z.string().url().or(z.literal('')),
    banner: z.string().url().or(z.literal('')),
    isOpen: z.boolean(),
    deliveryRadiusKm: z.number().finite().min(0),
    minOrderAmount: z.number().min(0).max(100000),
    deliveryFee: z.number().min(0).max(5000),
    gstin: z.string().trim().toUpperCase().max(15),
    address: z.object({ line1: z.string().trim().max(200), city: z.string().trim().max(60), state: z.string().trim().max(60), pincode: z.string().trim().max(10) }).partial(),
    location: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export const sellerCustomersQuery = pagination.extend({ q: z.string().trim().max(60).optional() });

/* ---------- gallery and videos ---------- */
import { videoInfo } from '../services/media.service';
const mediaBase = z.object({
  kind: z.enum(['photo', 'video']),
  title: z.string().trim().min(1, 'Add a title').max(100),
  caption: z.string().trim().max(300).optional(),
  url: z.string().trim().url('Paste a full link starting with https://').max(500),
  thumbnail: z.string().trim().url('The cover must be a full link').max(500).optional().or(z.literal('')),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});
export const mediaBody = mediaBase.refine((m) => m.kind !== 'video' || videoInfo(m.url) !== null, {
  path: ['url'],
  message: 'Paste a YouTube or Vimeo link, or a direct .mp4 / .webm file link',
});
export const mediaUpdateBody = mediaBase.partial().refine((m) => m.kind !== 'video' || !m.url || videoInfo(m.url) !== null, {
  path: ['url'],
  message: 'Paste a YouTube or Vimeo link, or a direct .mp4 / .webm file link',
});
export const mediaQuery = z.object({ kind: z.enum(['photo', 'video']).optional() });

/* ---------- bulk product upload ---------- */
export const bulkProductsBody = z.object({
  rows: z.array(z.record(z.unknown())).min(1, 'The file has no product rows').max(300, 'Upload at most 300 products at a time'),
  /** Check everything and report, but save nothing. */
  dryRun: z.boolean().optional(),
});

/* ---------- blog (#38) ---------- */
export const blogPostBody = z.object({
  title: z.string().trim().min(3).max(160),
  excerpt: z.string().trim().max(300).optional(),
  body: z.string().max(100000).default(''),
  cover: z.string().trim().max(500).optional(),
  author: z.string().trim().max(80).optional(),
  published: z.boolean().default(false),
});
export const blogPostUpdateBody = blogPostBody.partial();
export const blogSlugParam = z.object({ slug: z.string().trim().min(1).max(200) });
