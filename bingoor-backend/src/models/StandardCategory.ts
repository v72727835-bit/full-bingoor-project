import { Schema, model } from 'mongoose';

/**
 * A named row of products the admin pins to the very top or the very bottom of
 * the home screen ("Morning Breakfast"). The aisles sit in between. A product
 * joins a row by listing the row's name on it.
 */
export interface IStandardCategory {
  name: string;
  nameHi?: string;
  position: 'top' | 'bottom';
  /** Lower comes first among rows at the same end. */
  sortOrder: number;
  isActive: boolean;
}

const schema = new Schema<IStandardCategory>(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    nameHi: { type: String, trim: true, maxlength: 60 },
    position: { type: String, enum: ['top', 'bottom'], default: 'top', index: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const StandardCategory = model<IStandardCategory>('StandardCategory', schema);
