import { Schema, Types, model } from 'mongoose';

/** "Notify me" on an out-of-stock product: who to tell when it is back. */
export interface IStockAlert {
  product: Types.ObjectId;
  phone: string;
  user?: Types.ObjectId;
  notified: boolean;
}

const stockAlertSchema = new Schema<IStockAlert>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    phone: { type: String, required: true, trim: true },
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    notified: { type: Boolean, default: false },
  },
  { timestamps: true },
);
stockAlertSchema.index({ product: 1, phone: 1 }, { unique: true });

export const StockAlert = model<IStockAlert>('StockAlert', stockAlertSchema);
