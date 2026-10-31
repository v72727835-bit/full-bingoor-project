import { Schema, Types, model } from 'mongoose';

export interface ICartItem {
  product: Types.ObjectId;
  quantity: number;
}

export interface ICart {
  user: Types.ObjectId;
  items: ICartItem[];
}

export const MAX_QTY_PER_ITEM = 20;

const cartSchema = new Schema<ICart>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: {
      type: [
        {
          product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
          quantity: { type: Number, required: true, min: 1, max: MAX_QTY_PER_ITEM },
          _id: false,
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

export const Cart = model<ICart>('Cart', cartSchema);
