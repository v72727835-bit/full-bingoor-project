import { Schema, Types, model } from 'mongoose';
import { uniqueSlug } from '../utils/helpers';

/**
 * One collection holds all three levels; `parent` links them and `level` lets a
 * query jump straight to a depth without walking the tree.
 *
 *   1 group     "Grocery & Kitchen"   - a heading on the Categories page
 *   2 category  "Vegetables & Fruits" - the tile a customer taps
 *   3 child     "Fresh Vegetables"    - the rail down the left of the listing
 */
export interface ICategory {
  name: string;
  /** Hindi name; shown when a customer picks Hindi. */
  nameHi?: string;
  slug: string;
  /** Fluent Emoji Flat key; the app ships a matching PNG. */
  icon?: string;
  image?: string;
  /** Pastel background for the tile, so each aisle reads differently. */
  tint?: string;
  parent: Types.ObjectId | null;
  level: 1 | 2 | 3;
  sortOrder: number;
  isActive: boolean;
}

const categorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true },
    nameHi: { type: String, trim: true },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    icon: String,
    image: String,
    tint: String,
    parent: { type: Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    level: { type: Number, enum: [1, 2, 3], default: 1, index: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

categorySchema.index({ isActive: 1, level: 1, sortOrder: 1 });

categorySchema.pre('validate', function (next) {
  if (!this.slug) this.slug = uniqueSlug(this.name);
  next();
});

export const Category = model<ICategory>('Category', categorySchema);
