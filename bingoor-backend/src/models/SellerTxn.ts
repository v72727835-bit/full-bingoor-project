import { Schema, Types, model } from 'mongoose';

/**
 * One line in a seller's (warehouse's) earnings ledger.
 *
 * An `earning` is credited when an order carrying the seller's products is
 * delivered: the net is the item sales minus the super admin's commission. A
 * `withdrawal` is a payout the seller asks for; it is held `pending` until the
 * super admin verifies and pays it (through RazorpayX or by hand), then `paid`,
 * or `rejected` so the balance returns.
 */
export type SellerTxnKind = 'earning' | 'adjustment' | 'withdrawal';
export type SellerTxnStatus = 'completed' | 'pending' | 'paid' | 'rejected';

export interface ISellerTxn {
  seller: Types.ObjectId;
  kind: SellerTxnKind;
  /** Always positive; for an earning this is the net after commission. */
  amount: number;
  status: SellerTxnStatus;
  order?: Types.ObjectId;
  /** For an earning: the gross item sales and the commission taken out of them. */
  gross?: number;
  commission?: number;
  commissionPct?: number;
  /** For a withdrawal: how the seller wants to be paid. */
  method?: 'upi' | 'bank';
  destination?: string;
  reference?: string;
  payoutId?: string;
  payoutStatus?: string;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ISellerTxn>(
  {
    seller: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, enum: ['earning', 'adjustment', 'withdrawal'], required: true },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['completed', 'pending', 'paid', 'rejected'], default: 'completed' },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    gross: { type: Number, min: 0 },
    commission: { type: Number, min: 0 },
    commissionPct: { type: Number, min: 0 },
    method: { type: String, enum: ['upi', 'bank'] },
    destination: { type: String, trim: true },
    reference: { type: String, trim: true },
    payoutId: { type: String, trim: true },
    payoutStatus: { type: String, trim: true },
    note: { type: String, trim: true },
  },
  { timestamps: true },
);

schema.index({ seller: 1, createdAt: -1 });
schema.index({ kind: 1, status: 1 });
// One earning per seller per order (so a re-delivered/redundant credit can't double-pay).
schema.index({ seller: 1, order: 1, kind: 1 }, { unique: true, partialFilterExpression: { kind: 'earning', order: { $exists: true } } });

// At most one open withdrawal per seller (two parallel requests can't both pass the balance check).
schema.index({ seller: 1, kind: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });

export const SellerTxn = model<ISellerTxn>('SellerTxn', schema);
