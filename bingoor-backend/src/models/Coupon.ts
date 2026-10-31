import { Schema, Types, model } from 'mongoose';

/**
 * A discount code the customer types at checkout.
 *
 * `percent` takes `value` off the subtotal, capped at `maxDiscount`;
 * `flat` takes a fixed rupee amount off. A coupon only applies when the
 * subtotal reaches `minOrderAmount`, the window is open and `usedCount`
 * is still under `usageLimit` (0 = unlimited).
 */
export interface ICoupon {
  code: string;
  description?: string;
  discountType: 'percent' | 'flat';
  value: number;
  maxDiscount: number;
  minOrderAmount: number;
  startsAt?: Date | null;
  expiresAt?: Date | null;
  usageLimit: number;
  perUserLimit: number;
  usedCount: number;
  /** Empty = every shop honours it. */
  shops: Types.ObjectId[];
  isActive: boolean;
}

const couponSchema = new Schema<ICoupon>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: String,
    discountType: { type: String, enum: ['percent', 'flat'], default: 'percent' },
    value: { type: Number, required: true, min: 0 },
    maxDiscount: { type: Number, default: 0, min: 0 },
    minOrderAmount: { type: Number, default: 0, min: 0 },
    startsAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    usageLimit: { type: Number, default: 0, min: 0 },
    perUserLimit: { type: Number, default: 1, min: 0 },
    usedCount: { type: Number, default: 0, min: 0 },
    shops: [{ type: Schema.Types.ObjectId, ref: 'Shop' }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

couponSchema.index({ isActive: 1, expiresAt: 1 });

export const Coupon = model<ICoupon>('Coupon', couponSchema);
