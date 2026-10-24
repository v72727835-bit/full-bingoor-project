import { Schema, model } from 'mongoose';

/** A message the admin sends to every customer's notification bell. */
export interface INotice {
  message: string;
  createdAt: Date;
}

const noticeSchema = new Schema<INotice>({ message: { type: String, required: true, trim: true } }, { timestamps: true });
noticeSchema.index({ createdAt: -1 });

export const Notice = model<INotice>('Notice', noticeSchema);
