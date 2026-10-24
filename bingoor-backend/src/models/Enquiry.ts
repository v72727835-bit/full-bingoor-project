import { Schema, model } from 'mongoose';

export const ENQUIRY_LABELS: Record<string, string> = {
  city_manager: 'Contact with City manager',
  invest: 'Invest with us',
  delivery_partner: 'Delivery partner contact with us',
  seller: 'Sell your product with us',
  advertise: 'Advertise your brand with us',
  complaint: 'Complain to direct City manager',
};

/** The six contact forms on the website; each submission lands in the admin panel. */
export interface IEnquiry {
  kind: keyof typeof ENQUIRY_LABELS;
  fullName: string;
  email: string;
  mobile: string;
  otherPhone?: string;
  reason: string;
  createdAt: Date;
}

const enquirySchema = new Schema<IEnquiry>(
  {
    kind: { type: String, enum: Object.keys(ENQUIRY_LABELS), required: true, index: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    otherPhone: { type: String, trim: true },
    reason: { type: String, required: true, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const Enquiry = model<IEnquiry>('Enquiry', enquirySchema);
