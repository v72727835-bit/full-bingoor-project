import { Schema, Types, model } from 'mongoose';

/**
 * One document of shop-wide switches the admin panel edits: the festival tab,
 * the "6 days delivery" aisles, aisles where cash on delivery is off, the
 * rider cash limit and the app download links.
 */
export interface ISettings {
  key: 'global';
  festival: {
    enabled: boolean;
    /** Menu label, e.g. "Rakhi", "Diwali" - changed per festival. */
    name: string;
    banner?: string;
    /** Rows on the festival page: a title and the aisle its products come from. */
    sections: { title: string; category: Types.ObjectId }[];
  };
  /** Point 30: full-screen promo pages shown on a timer in the app and website. */
  popup: {
    enabled: boolean;
    /** How often a page appears, in seconds (default 210 = 3.5 min). */
    intervalSeconds: number;
    pages: { image: string; link?: string }[];
  };
  sixDay: {
    /** Delivery promise for these aisles, in days. */
    days: number;
    /** Sub categories (and everything under them) that ship in `days`. */
    categories: Types.ObjectId[];
  };
  cod: {
    /** Sub categories (and everything under them) where cash on delivery is off. */
    disabledCategories: Types.ObjectId[];
    message: string;
    /** When on, COD is refused every day from `cutoffTime` (IST) until midnight. */
    cutoffEnabled: boolean;
    /** "HH:MM" in 24h IST, e.g. "19:00" for 7 PM. */
    cutoffTime: string;
    /** Shown when a customer taps COD after the cutoff. */
    cutoffMessage: string;
  };
  /** A rider is paused automatically once this much COD cash is unsettled. */
  riderCodLimit: number;
  /** How a rider earns per delivery, by distance. */
  riderPay: {
    enabled: boolean;
    /** Flat amount added to every delivery. */
    baseFare: number;
    /** Distance bands: a run up to `maxKm` pays `pay` (the base fare is added on top). First match wins, cheapest first. */
    slabs: { maxKm: number; pay: number }[];
    /** Each km beyond the last band pays this much. */
    perKmBeyond: number;
    /** A delivery never pays less than this (base + slab together). */
    minPerOrder: number;
    /** Smallest amount a rider may withdraw at once. */
    minWithdraw: number;
  };
  /** How much a seller earns: their item sales minus the super admin's commission. */
  sellerPay: {
    /** Commission the super admin keeps, as a percent of item sales (not delivery fee). */
    commissionPct: number;
    /** Smallest amount a seller may withdraw at once. */
    minWithdraw: number;
  };
  appLinks: { android?: string; ios?: string; rider?: string; warehouse?: string };
  /** Company details printed on every bill (logo, signature, seal, GSTIN, declaration...). */
  company: {
    name?: string; tagline?: string; address?: string; phone?: string; email?: string; website?: string; gstin?: string; fssai?: string;
    logo?: string; signature?: string; seal?: string; signatoryName?: string; signatoryTitle?: string; declaration?: string; footerNote?: string;
  };
  /** Any other social / web pages the admin adds (name + link). */
  socialOther: { label: string; url: string }[];
  /** GST rules for the bills. */
  gst: { defaultRate: number; deliveryRate: number; homeState: string };
  /** Social media pages shown in the website footer and on every bill. */
  socialLinks: { facebook?: string; instagram?: string; youtube?: string; whatsapp?: string; x?: string; telegram?: string; linkedin?: string };
  /** Largest product photo (KB) the image tips recommend. */
  imageMaxKb: number;
  /** Shown in the cart header so a customer can call for help. */
  supportPhone?: string;
  /** The three delivery promises on the home page; each can be renamed or hidden. */
  deliverySlots: { key: 'instant' | 'twoHour' | 'nextDay'; label: string; enabled: boolean }[];
  /** Optional charge for the 2 hour slot. */
  twoHourCharge: { enabled: boolean; amount: number };
  /** Delivery pricing by distance from the warehouse. */
  pricing: {
    handlingFee: number;
    bands: { upToKm: number; minOrder: number; freeAbove: number; fee: number; nextDay: boolean; redOrder: boolean }[];
    /** Beyond the last band: delivery in this many days, COD off. */
    beyondDays: number;
    beyondMinOrder: number;
    /** Cash on delivery is refused past the last band when this is on. */
    beyondCodDisabled: boolean;
    /** Shown when a long-distance customer taps COD. */
    beyondCodMessage: string;
    /** Point 37: the only categories (any level) a long-distance customer sees; empty = all. */
    beyondCategories?: Types.ObjectId[];
    /** Point 37: standard-category rows (home rows) a long-distance customer also sees. */
    beyondStandardCategories?: Types.ObjectId[];
    /** Point 37: single products (e.g. from the festival / Diwali menu) a long-distance customer also sees. */
    beyondProducts?: Types.ObjectId[];
  };
  /** Filters shown on listing pages; the admin can rename, reorder and hide them. */
  filters: { key: string; label: string; kind: 'brand' | 'price' | 'discount' | 'rating' | 'diet' | 'stock'; enabled: boolean }[];
  priceSortEnabled: boolean;
  /** Where customers are sent to leave a Google review after delivery. */
  googleReviewUrl?: string;
  /** Hidden cart-points rule: checkout opens once the basket reaches `target`. */
  cartPoints: { enabled: boolean; target: number; suggestions: Types.ObjectId[] };
  /**
   * #36: the payment choices at checkout and what each one costs the customer,
   * as a percent of the bill. `highPct` replaces `pct` once the bill reaches
   * `highFrom` (debit card: 0.40% up to 1999, 0.90% from 2000).
   */
  paymentOptions: PaymentOptionSetting[];
}

export type PayOption = 'upi' | 'cod' | 'debit' | 'netbanking' | 'credit' | 'rupay';
export const PAY_OPTIONS: PayOption[] = ['upi', 'cod', 'debit', 'netbanking', 'credit', 'rupay'];
export interface PaymentOptionSetting {
  key: PayOption;
  label: string;
  /** Shown under the option once it is picked, e.g. "PhonePe, Google Pay, Paytm, BHIM... are free". */
  note?: string;
  enabled: boolean;
  pct: number;
  highPct?: number;
  highFrom?: number;
}

export const DEFAULT_PAYMENT_OPTIONS: PaymentOptionSetting[] = [
  { key: 'upi', label: 'UPI ID / UPI scanner', note: 'PhonePe, Google Pay, Paytm, BHIM, CRED UPI or any UPI app / scanner - free', enabled: true, pct: 0 },
  { key: 'cod', label: 'Cash on delivery', note: 'Free', enabled: true, pct: 0 },
  { key: 'debit', label: 'Debit card', enabled: true, pct: 0.4, highPct: 0.9, highFrom: 2000 },
  { key: 'netbanking', label: 'Net banking', enabled: true, pct: 1.8 },
  { key: 'credit', label: 'Credit card', enabled: true, pct: 2 },
  { key: 'rupay', label: 'RuPay debit card', note: 'Free', enabled: true, pct: 0 },
];

const settingsSchema = new Schema<ISettings>(
  {
    key: { type: String, default: 'global', unique: true },
    festival: {
      enabled: { type: Boolean, default: true },
      name: { type: String, default: 'Rakhi', trim: true },
      banner: String,
      sections: {
        type: [{ title: { type: String, trim: true }, category: { type: Schema.Types.ObjectId, ref: 'Category' }, _id: false }],
        default: [],
      },
    },
    popup: {
      enabled: { type: Boolean, default: false },
      intervalSeconds: { type: Number, default: 210, min: 15, max: 3600 },
      pages: {
        type: [{ image: { type: String, trim: true }, link: { type: String, trim: true }, _id: false }],
        default: [],
      },
    },
    sixDay: {
      days: { type: Number, default: 6, min: 1, max: 60 },
      categories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    },
    cod: {
      disabledCategories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
      message: {
        type: String,
        default: 'Cash on delivery is not available for fruits and vegetables. You can buy other products with COD.',
      },
      cutoffEnabled: { type: Boolean, default: false },
      cutoffTime: { type: String, default: '19:00', trim: true },
      cutoffMessage: { type: String, default: 'After 7 PM COD option is not available', trim: true },
    },
    riderCodLimit: { type: Number, default: 2000, min: 0 },
    riderPay: {
      enabled: { type: Boolean, default: true },
      baseFare: { type: Number, default: 10, min: 0 },
      slabs: {
        type: [{ maxKm: { type: Number, min: 0 }, pay: { type: Number, min: 0 }, _id: false }],
        default: [{ maxKm: 2, pay: 15 }, { maxKm: 5, pay: 25 }, { maxKm: 10, pay: 40 }],
      },
      perKmBeyond: { type: Number, default: 6, min: 0 },
      minPerOrder: { type: Number, default: 15, min: 0 },
      minWithdraw: { type: Number, default: 100, min: 0 },
    },
    sellerPay: {
      commissionPct: { type: Number, default: 10, min: 0, max: 100 },
      minWithdraw: { type: Number, default: 500, min: 0 },
    },
    appLinks: { android: String, ios: String, rider: String, warehouse: String },
    company: {
      name: { type: String, trim: true }, tagline: { type: String, trim: true }, address: { type: String, trim: true }, phone: { type: String, trim: true },
      email: { type: String, trim: true }, website: { type: String, trim: true }, gstin: { type: String, trim: true }, fssai: { type: String, trim: true },
      logo: String, signature: String, seal: String, signatoryName: { type: String, trim: true }, signatoryTitle: { type: String, trim: true },
      declaration: { type: String, trim: true }, footerNote: { type: String, trim: true },
    },
    gst: {
      defaultRate: { type: Number, default: 0, min: 0, max: 28 },
      deliveryRate: { type: Number, default: 18, min: 0, max: 28 },
      homeState: { type: String, default: 'Uttar Pradesh', trim: true },
    },
    socialOther: { type: [{ label: { type: String, trim: true }, url: { type: String, trim: true }, _id: false }], default: [] },
    socialLinks: { facebook: String, instagram: String, youtube: String, whatsapp: String, x: String, telegram: String, linkedin: String },
    imageMaxKb: { type: Number, default: 200 },
    supportPhone: { type: String, trim: true },
    deliverySlots: {
      type: [{ key: String, label: { type: String, trim: true }, enabled: { type: Boolean, default: true }, _id: false }],
      default: [
        { key: 'instant', label: '19 minutes', enabled: true },
        { key: 'twoHour', label: '2 hours', enabled: true },
        { key: 'nextDay', label: 'Next day delivery', enabled: true },
      ],
    },
    twoHourCharge: { enabled: { type: Boolean, default: false }, amount: { type: Number, default: 0, min: 0 } },
    pricing: {
      handlingFee: { type: Number, default: 2, min: 0 },
      bands: {
        type: [
          {
            upToKm: Number,
            minOrder: Number,
            freeAbove: Number,
            fee: Number,
            nextDay: { type: Boolean, default: false },
            redOrder: { type: Boolean, default: false },
            _id: false,
          },
        ],
        default: [
          { upToKm: 9, minOrder: 199, freeAbove: 199, fee: 39, nextDay: false, redOrder: false },
          { upToKm: 15, minOrder: 199, freeAbove: 999, fee: 39, nextDay: false, redOrder: true },
          { upToKm: 25, minOrder: 199, freeAbove: 699, fee: 39, nextDay: true, redOrder: false },
          { upToKm: 30, minOrder: 199, freeAbove: 1199, fee: 39, nextDay: true, redOrder: false },
        ],
      },
      beyondDays: { type: Number, default: 3, min: 1 },
      beyondMinOrder: { type: Number, default: 199, min: 0 },
      beyondCodDisabled: { type: Boolean, default: true },
      beyondCodMessage: { type: String, default: 'For long distance "COD" option is not available', trim: true },
      beyondCategories: { type: [{ type: Schema.Types.ObjectId, ref: 'Category' }], default: [] },
      beyondStandardCategories: { type: [{ type: Schema.Types.ObjectId, ref: 'StandardCategory' }], default: [] },
      beyondProducts: { type: [{ type: Schema.Types.ObjectId, ref: 'Product' }], default: [] },
    },
    filters: {
      type: [{ key: String, label: { type: String, trim: true }, kind: String, enabled: { type: Boolean, default: true }, _id: false }],
      default: [
        { key: 'brand', label: 'Brand', kind: 'brand', enabled: true },
        { key: 'price', label: 'Price', kind: 'price', enabled: true },
        { key: 'discount', label: 'Discount', kind: 'discount', enabled: true },
        { key: 'rating', label: 'Customer rating', kind: 'rating', enabled: true },
        { key: 'diet', label: 'Veg / Non-veg', kind: 'diet', enabled: true },
        { key: 'stock', label: 'In stock only', kind: 'stock', enabled: true },
      ],
    },
    priceSortEnabled: { type: Boolean, default: true },
    googleReviewUrl: { type: String, trim: true },
    paymentOptions: {
      type: [
        {
          key: { type: String, enum: ['upi', 'cod', 'debit', 'netbanking', 'credit', 'rupay'] },
          label: { type: String, trim: true },
          note: { type: String, trim: true },
          enabled: { type: Boolean, default: true },
          pct: { type: Number, default: 0, min: 0, max: 10 },
          highPct: { type: Number, min: 0, max: 10 },
          highFrom: { type: Number, min: 0 },
          _id: false,
        },
      ],
      default: DEFAULT_PAYMENT_OPTIONS,
    },
    cartPoints: {
      enabled: { type: Boolean, default: false },
      target: { type: Number, default: 47, min: 1, max: 5000 },
      suggestions: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    },
  },
  { timestamps: true },
);

export const Settings = model<ISettings>('Settings', settingsSchema);
