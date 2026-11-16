import { Schema, Types, model } from 'mongoose';

export const ORDER_STATUSES = [
  'placed',
  'accepted',
  'preparing',
  'ready_for_pickup',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'rejected',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Statuses from which a customer may still cancel. */
export const CUSTOMER_CANCELLABLE: OrderStatus[] = ['placed', 'accepted'];

export const PAYMENT_METHODS = ['cod', 'online'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refund_pending', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export interface IOrderItem {
  product: Types.ObjectId;
  name: string;
  image?: string;
  /** Artwork key, so an old order still shows the right picture. */
  icon?: string;
  unit: string;
  price: number;
  mrp: number;
  quantity: number;
  lineTotal: number;
  /** Printed on the GST invoice; copied at order time so an old bill never changes. */
  hsn?: string;
  gstRate?: number | null;
  /** The seller who listed this product, if any. */
  seller?: Types.ObjectId;
}

export interface IOrder {
  orderNumber: string;
  checkoutId: string; // shared by all shop-orders created from one checkout
  user: Types.ObjectId;
  shop: Types.ObjectId;
  /** Who delivers this order: our own rider (default) or the Shiprocket courier network. */
  fulfillment?: 'rider' | 'shiprocket';
  /** Set when the order is pushed to Shiprocket: their ids and the assigned courier/AWB. */
  shiprocket?: {
    orderId?: string;
    shipmentId?: string;
    awb?: string;
    courier?: string;
    labelUrl?: string;
    status?: string;
    syncedAt?: Date;
  };
  rider?: Types.ObjectId;
  /** Last position the rider's phone reported while out for delivery. */
  riderLocation?: { lat: number; lng: number; at: Date };
  /** COD cash the rider has handed to the cash department. */
  codSettled?: boolean;
  /** Longest delivery promise in the order, in days (e.g. 6); absent = same day. */
  deliveryDays?: number;
  /** Sellers whose products are in this order (for their dashboards). */
  sellerIds?: Types.ObjectId[];
  /** Which home-page slot the customer picked. */
  slot?: 'instant' | 'twoHour' | 'nextDay';
  handlingFee?: number;
  /** #36: how the customer chose to pay (UPI, debit card...) and what that choice added to the bill. */
  payOption?: 'upi' | 'cod' | 'debit' | 'netbanking' | 'credit' | 'rupay';
  paymentFee?: number;
  /** #35: tip for the delivery partner (no GST); credited to the rider with the delivery earning. */
  tip?: number;
  /** 9-15 km orders go to the rider in red. */
  redOrder?: boolean;
  /** Beyond the last band: only the special long-distance rider sees it. */
  longDistance?: boolean;
  distanceKm?: number;
  items: IOrderItem[];
  address: {
    name: string;
    phone: string;
    line1: string;
    line2?: string;
    landmark?: string;
    city: string;
    state: string;
    pincode: string;
    location?: { lat: number; lng: number };
  };
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  /** The gateway's payment id for online orders. */
  paymentRef?: string;
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: Date; note?: string }[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  note?: string;
  deliveryOtp: string;
  cancelledBy?: 'customer' | 'shop' | 'admin';
  cancelReason?: string;
  deliveredAt?: Date;
  /** True when the rider marked it delivered without the customer's OTP (audit trail). */
  deliveredWithoutOtp?: boolean;
  /** Where the rider's phone was when they marked it delivered without the OTP. */
  deliveredAtLocation?: { lat: number; lng: number };
  /** What the rider earned for this delivery (set when delivered). */
  riderEarning?: number;
  /** Distance used for that earning, in km. */
  riderEarningKm?: number;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true },
    checkoutId: { type: String, required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    shop: { type: Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
    fulfillment: { type: String, enum: ['rider', 'shiprocket'], default: 'rider' },
    shiprocket: {
      orderId: String,
      shipmentId: String,
      awb: String,
      courier: String,
      labelUrl: String,
      status: String,
      syncedAt: Date,
    },
    rider: { type: Schema.Types.ObjectId, ref: 'User' },
    riderLocation: { lat: Number, lng: Number, at: Date },
    codSettled: { type: Boolean, default: false },
    deliveryDays: Number,
    slot: { type: String, enum: ['instant', 'twoHour', 'nextDay'] },
    handlingFee: { type: Number, default: 0 },
    payOption: { type: String, enum: ['upi', 'cod', 'debit', 'netbanking', 'credit', 'rupay'] },
    paymentFee: { type: Number, default: 0 },
    tip: { type: Number, default: 0, min: 0 },
    redOrder: { type: Boolean, default: false },
    longDistance: { type: Boolean, default: false, index: true },
    distanceKm: Number,
    sellerIds: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: undefined, index: true },
    items: {
      type: [
        {
          product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
          name: { type: String, required: true },
          image: String,
          icon: String,
          unit: String,
          price: { type: Number, required: true },
          mrp: { type: Number, required: true },
          hsn: String,
          gstRate: Number,
          quantity: { type: Number, required: true, min: 1 },
          lineTotal: { type: Number, required: true },
          seller: { type: Schema.Types.ObjectId, ref: 'User' },
          _id: false,
        },
      ],
      required: true,
    },
    address: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      line1: { type: String, required: true },
      line2: String,
      landmark: String,
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      location: { lat: Number, lng: Number },
    },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, required: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'pending' },
    paymentRef: String,
    status: { type: String, enum: ORDER_STATUSES, default: 'placed', index: true },
    statusHistory: {
      type: [
        {
          status: { type: String, enum: ORDER_STATUSES, required: true },
          at: { type: Date, default: Date.now },
          note: String,
          _id: false,
        },
      ],
      default: [],
    },
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    note: { type: String, trim: true, maxlength: 300 },
    deliveryOtp: { type: String, required: true },
    cancelledBy: { type: String, enum: ['customer', 'shop', 'admin'] },
    cancelReason: String,
    deliveredAt: Date,
    deliveredWithoutOtp: { type: Boolean, default: false },
    deliveredAtLocation: { lat: Number, lng: Number, _id: false },
    riderEarning: { type: Number, default: 0, min: 0 },
    riderEarningKm: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

orderSchema.index({ user: 1, createdAt: -1 });
// ISSUE-08: POST /rider/location runs updateMany({ rider, status }) on every
// heartbeat; without this index each heartbeat is a full collection scan.
orderSchema.index({ rider: 1, status: 1 });
// Seller/warehouse order lists and the admin order feed filter by shop/status
// and sort by newest.
orderSchema.index({ shop: 1, status: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

export const Order = model<IOrder>('Order', orderSchema);
