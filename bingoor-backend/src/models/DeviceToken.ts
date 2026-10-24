import { Schema, Types, model } from 'mongoose';

/** A phone, browser or rider app that can receive push notifications for a user. */
export interface IDeviceToken {
  user: Types.ObjectId;
  token: string;
  platform: 'web' | 'android' | 'ios';
  app: 'customer' | 'rider' | 'warehouse' | 'web';
}

const schema = new Schema<IDeviceToken>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: ['web', 'android', 'ios'], default: 'android' },
    app: { type: String, enum: ['customer', 'rider', 'warehouse', 'web'], default: 'customer' },
  },
  { timestamps: true },
);

export const DeviceToken = model<IDeviceToken>('DeviceToken', schema);
