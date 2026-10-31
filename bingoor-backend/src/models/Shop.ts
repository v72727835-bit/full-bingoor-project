import { Schema, Types, model } from 'mongoose';
import { uniqueSlug } from '../utils/helpers';

export interface IShop {
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  banner?: string;
  owner: Types.ObjectId;
  phone?: string;
  address: { line1?: string; city?: string; state?: string; pincode?: string };
  location: { type: 'Point'; coordinates: [number, number] }; // [lng, lat]
  isOpen: boolean;
  isActive: boolean;
  rating: number;
  ratingCount: number;
  deliveryRadiusKm: number;
  minOrderAmount: number;
  deliveryFee: number;
  /** The warehouse's own GSTIN, printed on its bills (falls back to the company GSTIN). */
  gstin?: string;
}

const shopSchema = new Schema<IShop>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true },
    logo: String,
    banner: String,
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    phone: String,
    address: {
      line1: String,
      city: String,
      state: String,
      pincode: String,
    },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    isOpen: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0 },
    deliveryRadiusKm: { type: Number, default: 10 },
    minOrderAmount: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 30 },
    gstin: { type: String, trim: true, uppercase: true },
  },
  { timestamps: true },
);

shopSchema.index({ location: '2dsphere' });
shopSchema.index({ isActive: 1, isOpen: 1 });

shopSchema.pre('validate', function (next) {
  if (!this.slug) this.slug = uniqueSlug(this.name);
  next();
});

export const Shop = model<IShop>('Shop', shopSchema);
