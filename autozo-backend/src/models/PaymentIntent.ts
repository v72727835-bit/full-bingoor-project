import { Schema, Types, model } from 'mongoose';

/** A started online payment. The order itself is only created once the payment is verified. */
export interface IPaymentIntent {
  user: Types.ObjectId;
  razorpayOrderId: string;
  amount: number;
  payload: { addressId: string; note?: string; slot: 'instant' | 'twoHour' | 'nextDay'; payOption?: 'upi' | 'debit' | 'netbanking' | 'credit' | 'rupay'; tip?: number };
  status: 'created' | 'paid' | 'refunded' | 'failed';
  paymentId?: string;
}

const schema = new Schema<IPaymentIntent>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    razorpayOrderId: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: ['created', 'paid', 'refunded', 'failed'], default: 'created' },
    paymentId: String,
  },
  { timestamps: true },
);

export const PaymentIntent = model<IPaymentIntent>('PaymentIntent', schema);
