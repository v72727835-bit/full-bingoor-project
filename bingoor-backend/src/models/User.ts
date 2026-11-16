import bcrypt from 'bcryptjs';
import { HydratedDocument, Model, Schema, Types, model } from 'mongoose';

export interface IAddress {
  _id: Types.ObjectId;
  label: 'home' | 'work' | 'other';
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  location?: { lat: number; lng: number };
  isDefault: boolean;
}

export interface IUser {
  name: string;
  phone: string;
  email?: string;
  /** A customer's own GST number, printed under their name on every bill (old ones too). */
  gstin?: string;
  password: string;
  role: 'customer' | 'rider' | 'shop' | 'admin' | 'seller';
  /** Riders: the first warehouse (kept for old data). `warehouses` is the full list they deliver for. */
  warehouse?: Types.ObjectId;
  warehouses?: Types.ObjectId[];
  avatar?: string;
  isActive: boolean;
  deletedAt?: Date;
  addresses: Types.DocumentArray<IAddress>;
  wishlist: Types.ObjectId[];
  refreshTokens: { hash: string; createdAt: Date }[];
  lastLoginAt?: Date;
  /** Riders: last request from the app; recent = online. Cleared on logout. */
  lastSeenAt?: Date | null;
  /** Riders: paused riders get no new orders until an admin resumes them. */
  riderPaused?: boolean;
  riderPausedAt?: Date | null;
  /** Riders: deliveries they accepted and then dropped. */
  riderCancelCount?: number;
  /** The one rider (or few) who receives orders beyond the last distance band. */
  riderLongDistance?: boolean;
  /** Customers who signed in with Google / Facebook. */
  /** The phone number was proven (set by older builds that had an OTP step). */
  phoneVerified?: boolean;
  /** Where a rider is paid their earnings. */
  payout?: { upi?: string; bankHolder?: string; bankNumber?: string; bankIfsc?: string; rzpContactId?: string; rzpFundAccountId?: string; rzpFundFingerprint?: string };
  googleId?: string;
  facebookId?: string;
  instagramId?: string;
  /** Sellers: unique id shown on their dashboard and in the admin panel. */
  sellerId?: string;
  /** Sellers: the warehouses whose orders they see and where their listings are stocked. */
  sellerWarehouses?: Types.ObjectId[];
  /**
   * Sellers: 'product' is a product seller (#45) who only lists products and
   * sees just product name, quantity and payment of their own orders - never the
   * customer. Absent / 'warehouse' is the warehouse panel that packs and dispatches.
   */
  sellerKind?: 'warehouse' | 'product';
  /** Sellers: the one-time registration form. Once `locked`, only the admin can clear it. */
  sellerProfile?: {
    firm: string;
    address: string;
    mobile: string;
    aadhaar?: string;
    pan?: string;
    bankName: string;
    accountNumber: string;
    holderName: string;
    accountType: 'current' | 'savings';
    ifsc: string;
    locked: boolean;
    submittedAt: Date;
  };
  /** Sellers: orders placed before this moment have been seen (popup closed). */
  sellerAckAt?: Date;
  /** Warehouses that registered themselves: no login until the admin approves. Absent = admin-created (approved). */
  sellerStatus?: 'pending' | 'approved' | 'rejected';
  sellerRejectReason?: string;
  warehouseApplication?: {
    shopName: string;
    line1: string;
    city: string;
    state: string;
    pincode: string;
    lat: number;
    lng: number;
    gst?: string;
    note?: string;
    submittedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface IUserMethods {
  comparePassword(candidate: string): Promise<boolean>;
}

export type UserDoc = HydratedDocument<IUser, IUserMethods>;
type UserModel = Model<IUser, {}, IUserMethods>;

const addressSchema = new Schema<IAddress>({
  label: { type: String, enum: ['home', 'work', 'other'], default: 'home' },
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  line1: { type: String, required: true, trim: true },
  line2: { type: String, trim: true },
  landmark: { type: String, trim: true },
  city: { type: String, required: true, trim: true },
  state: { type: String, required: true, trim: true },
  pincode: { type: String, required: true, trim: true },
  location: { lat: Number, lng: Number },
  isDefault: { type: Boolean, default: false },
});

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    gstin: { type: String, uppercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['customer', 'rider', 'shop', 'admin', 'seller'],
      default: 'customer',
      index: true,
    },
    avatar: String,
    warehouse: { type: Schema.Types.ObjectId, ref: 'Shop', index: true },
    warehouses: { type: [{ type: Schema.Types.ObjectId, ref: 'Shop' }], default: undefined, index: true },
    isActive: { type: Boolean, default: true },
    deletedAt: Date,
    addresses: [addressSchema],
    wishlist: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    refreshTokens: {
      type: [{ hash: String, createdAt: { type: Date, default: Date.now }, _id: false }],
      select: false,
      default: [],
    },
    lastLoginAt: Date,
    lastSeenAt: { type: Date, default: null },
    riderPaused: { type: Boolean, default: false },
    riderPausedAt: { type: Date, default: null },
    riderCancelCount: { type: Number, default: 0 },
    riderLongDistance: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    payout: {
      upi: { type: String, trim: true },
      bankHolder: { type: String, trim: true },
      bankNumber: { type: String, trim: true },
      bankIfsc: { type: String, trim: true, uppercase: true },
      // RazorpayX contact + fund account ids, cached so we don't recreate them on every payout.
      rzpContactId: { type: String, trim: true },
      rzpFundAccountId: { type: String, trim: true },
      rzpFundFingerprint: { type: String, trim: true },
    },
    googleId: { type: String, unique: true, sparse: true },
    facebookId: { type: String, unique: true, sparse: true },
    instagramId: { type: String, unique: true, sparse: true },
    sellerId: { type: String, unique: true, sparse: true },
    sellerWarehouses: { type: [{ type: Schema.Types.ObjectId, ref: 'Shop' }], default: undefined },
    sellerKind: { type: String, enum: ['warehouse', 'product'] },
    sellerProfile: {
      type: {
        firm: String,
        address: String,
        mobile: String,
        aadhaar: String,
        pan: String,
        bankName: String,
        accountNumber: String,
        holderName: String,
        accountType: { type: String, enum: ['current', 'savings'] },
        ifsc: String,
        locked: { type: Boolean, default: true },
        submittedAt: Date,
        _id: false,
      },
      default: undefined,
    },
    sellerAckAt: Date,
    sellerStatus: { type: String, enum: ['pending', 'approved', 'rejected'], index: true },
    sellerRejectReason: String,
    warehouseApplication: {
      type: {
        shopName: String,
        line1: String,
        city: String,
        state: String,
        pincode: String,
        lat: Number,
        lng: Number,
        gst: String,
        note: String,
        submittedAt: Date,
        _id: false,
      },
      default: undefined,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.password;
        delete ret.refreshTokens;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// One phone number / email may be used once per kind of account: the same person can be a customer, a rider and a warehouse owner.
// Faster "riders of this warehouse, who is online" lookups (listMyRiders).
userSchema.index({ role: 1, warehouse: 1, lastSeenAt: -1 });
userSchema.index({ phone: 1, role: 1 }, { unique: true });
userSchema.index({ email: 1, role: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } });

userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

userSchema.methods.comparePassword = function (candidate: string) {
  return bcrypt.compare(candidate, this.password);
};

export const User = model<IUser, UserModel>('User', userSchema);

/** Every warehouse a rider delivers for: the new list, or the single old field. */
export function riderWarehouseIds(u: { warehouse?: Types.ObjectId | null; warehouses?: Types.ObjectId[] | null }): Types.ObjectId[] {
  if (u.warehouses?.length) return u.warehouses;
  return u.warehouse ? [u.warehouse] : [];
}
