import { Schema, Types, model } from 'mongoose';

/**
 * One line in a rider's earnings passbook.
 *
 * Earnings (credits) build up as the rider delivers; a withdrawal moves money
 * out to their UPI / bank and is held until an admin marks it paid. A
 * cash-submit is the rider telling us they handed the collected COD cash to
 * the office — it is confirmed by an admin and does not touch the earnings
 * balance, it just clears what they owe.
 */
export type WalletKind = 'earning' | 'bonus' | 'adjustment' | 'withdrawal' | 'cash_submit';
export type WalletStatus = 'completed' | 'pending' | 'paid' | 'rejected' | 'confirmed';

export interface IWalletTxn {
  rider: Types.ObjectId;
  kind: WalletKind;
  /** Always positive; `kind` says whether it is money in or out. */
  amount: number;
  status: WalletStatus;
  order?: Types.ObjectId;
  /** For a withdrawal: how the rider wants to be paid. */
  method?: 'upi' | 'bank';
  destination?: string;
  /** Payment reference an admin enters when marking a withdrawal paid. */
  reference?: string;
  /** For a RazorpayX payout: the payout id and its latest status from RazorpayX. */
  payoutId?: string;
  payoutStatus?: string;
  note?: string;
  km?: number;
  createdAt: Date;
  updatedAt: Date;
}

const walletTxnSchema = new Schema<IWalletTxn>(
  {
    rider: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, enum: ['earning', 'bonus', 'adjustment', 'withdrawal', 'cash_submit'], required: true },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['completed', 'pending', 'paid', 'rejected', 'confirmed'], default: 'completed' },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    method: { type: String, enum: ['upi', 'bank'] },
    destination: { type: String, trim: true },
    reference: { type: String, trim: true },
    note: { type: String, trim: true },
    km: { type: Number, min: 0 },
  },
  { timestamps: true },
);

walletTxnSchema.index({ rider: 1, createdAt: -1 });
walletTxnSchema.index({ kind: 1, status: 1 });

export const WalletTxn = model<IWalletTxn>('WalletTxn', walletTxnSchema);
