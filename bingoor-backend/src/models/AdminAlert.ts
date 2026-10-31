import { Schema, Types, model } from 'mongoose';

/** Items for the admin dashboard bell, e.g. "Rider Ravi was paused at ₹2,140 COD". */
export interface IAdminAlert {
  type: 'rider_paused' | 'warehouse_registered';
  message: string;
  rider?: Types.ObjectId;
  user?: Types.ObjectId;
  read: boolean;
}

const adminAlertSchema = new Schema<IAdminAlert>(
  {
    type: { type: String, enum: ['rider_paused', 'warehouse_registered'], required: true },
    message: { type: String, required: true },
    rider: { type: Schema.Types.ObjectId, ref: 'User' },
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

export const AdminAlert = model<IAdminAlert>('AdminAlert', adminAlertSchema);
