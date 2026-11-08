import { Schema, Types, model } from 'mongoose';
import { uniqueSlug } from '../utils/helpers';

export interface IProduct {
  shop: Types.ObjectId;
  /** Always the deepest (level 3) category, so listings can roll up cleanly. */
  category: Types.ObjectId;
  name: string;
  slug: string;
  brand?: string;
  description?: string;
  images: string[];
  /** Optional product video: an uploaded .mp4/.webm file or a YouTube / Vimeo link. */
  video?: string;
  /** Fluent Emoji Flat key used when there is no photograph. */
  icon?: string;
  price: number; // selling price
  mrp: number; // maximum retail price (>= price)
  unit: string; // e.g. "1 kg", "500 ml", "1 pc"
  stock: number;
  /** Short chips shown under the name: "Cotton", "Spicy", "SPF 50". */
  attributes: string[];
  /** Drives the green/brown veg marker; empty for non-food. */
  foodType: 'veg' | 'nonveg' | '';
  tags: string[];
  /** GST: HSN code and the rate (%) the price already includes. Empty rate = the shop-wide default. */
  hsn?: string;
  gstRate?: number | null;
  /** How this product may be paid for: cash on delivery, online, or either. */
  paymentMode?: 'both' | 'cod' | 'online';
  isActive: boolean;
  rating: number;
  ratingCount: number;
  /** Shown instead of the count when set, e.g. "5L+", "20K", "12". */
  ratingLabel?: string;
  /** Real average and count from delivered-customer reviews (internal; cards/detail still show the admin's rating/ratingCount). */
  realRating: number;
  realRatingCount: number;
  /** Products sharing a group are sizes/variants of one another (e.g. 100 g, 200 g). */
  variantGroup?: string;
  /** This product's chip in the size picker, e.g. "200 g". Defaults to `unit`. */
  variantLabel?: string;
  soldCount: number;
  /** Hindi name; shown when a customer picks Hindi. */
  nameHi?: string;
  /** Hidden cart-points value for this size (0-50). */
  points: number;
  /** Admin tick: show this product in the cart / checkout top-up (50-point) list. */
  cartFeatured: boolean;
  /** Admin-picked for the Deals of the Day strip (unlimited). */
  dealOfDay: boolean;
  /** Admin-set ordering (lower first); the default is last, so unsorted items fall back to A-Z. */
  sortCode: number;
  /** Set when a seller listed it. */
  seller?: Types.ObjectId;
  /** Home-screen rows this product appears in (top / bottom of the home page). */
  standardCategories?: Types.ObjectId[];
}

const productSchema = new Schema<IProduct>(
  {
    shop: { type: Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    brand: { type: String, trim: true, index: true },
    description: { type: String, trim: true },
    images: { type: [String], default: [] },
    video: { type: String, trim: true },
    icon: String,
    price: { type: Number, required: true, min: 0 },
    mrp: { type: Number, required: true, min: 0 },
    unit: { type: String, default: '1 pc', trim: true },
    stock: { type: Number, default: 0, min: 0 },
    attributes: { type: [String], default: [] },
    foodType: { type: String, enum: ['veg', 'nonveg', ''], default: '' },
    tags: { type: [String], default: [] },
    hsn: { type: String, trim: true },
    gstRate: { type: Number, min: 0, max: 28 },
    paymentMode: { type: String, enum: ['both', 'cod', 'online'], default: 'both' },
    isActive: { type: Boolean, default: true },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0 },
    ratingLabel: { type: String, trim: true },
    realRating: { type: Number, default: 0, min: 0, max: 5 },
    realRatingCount: { type: Number, default: 0 },
    variantGroup: { type: String, trim: true, lowercase: true, index: true },
    variantLabel: { type: String, trim: true },
    soldCount: { type: Number, default: 0 },
    nameHi: { type: String, trim: true },
    points: { type: Number, default: 0, min: 0, max: 50 },
    cartFeatured: { type: Boolean, default: false, index: true },
    dealOfDay: { type: Boolean, default: false, index: true },
    sortCode: { type: Number, default: 1_000_000 },
    seller: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    standardCategories: { type: [{ type: Schema.Types.ObjectId, ref: 'StandardCategory' }], default: undefined, index: true },
  },
  { timestamps: true },
);

productSchema.index({ isActive: 1, category: 1, price: 1 });
productSchema.index({ isActive: 1, soldCount: -1 });
productSchema.index({ isActive: 1, shop: 1, soldCount: -1, rating: -1 });
productSchema.index({ isActive: 1, standardCategories: 1, sortCode: 1, name: 1 });
productSchema.index({ name: 1 });
productSchema.index({ isActive: 1, brand: 1 });
productSchema.index({ isActive: 1, dealOfDay: 1, soldCount: -1 });
// ISSUE-13: cover the default browse sort ({ sortCode, name }), "newest" and
// "rating" sorts so they do not fall back to in-memory sorts / the 32 MB limit.
productSchema.index({ isActive: 1, sortCode: 1, name: 1 });
productSchema.index({ isActive: 1, createdAt: -1 });
productSchema.index({ isActive: 1, rating: -1, ratingCount: -1 });
// Full-text search over name, brand and tags (brand weighted below name) so the
// search box does not rely on unindexed $regex scans.
productSchema.index({ name: 'text', brand: 'text', tags: 'text' }, { weights: { name: 10, brand: 5, tags: 1 }, name: 'product_text' });

productSchema.pre('validate', function (next) {
  if (!this.slug) this.slug = uniqueSlug(this.name);
  if (this.mrp < this.price) this.mrp = this.price;
  next();
});

export const Product = model<IProduct>('Product', productSchema);
