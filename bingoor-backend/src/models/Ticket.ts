import { Schema, Types, model } from 'mongoose';

/** "Chat with customer care": a customer's query and the back-and-forth with the admin team. */
export interface ITicket {
  user: Types.ObjectId;
  phone: string;
  query: string;
  status: 'open' | 'closed';
  messages: { from: 'customer' | 'admin'; text: string; at: Date }[];
  /** Admin replies the customer has not opened yet - drives the badge on the menu. */
  customerUnread: number;
  /** New customer messages the admin has not opened yet. */
  adminUnread: number;
  lastMessageAt: Date;
}

const ticketSchema = new Schema<ITicket>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    phone: { type: String, required: true, trim: true },
    query: { type: String, required: true, trim: true },
    status: { type: String, enum: ['open', 'closed'], default: 'open', index: true },
    messages: {
      type: [{ from: { type: String, enum: ['customer', 'admin'] }, text: String, at: { type: Date, default: Date.now }, _id: false }],
      default: [],
    },
    customerUnread: { type: Number, default: 0 },
    adminUnread: { type: Number, default: 0 },
    lastMessageAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

export const Ticket = model<ITicket>('Ticket', ticketSchema);
