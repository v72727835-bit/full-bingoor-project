import { Types } from 'mongoose';
import { Enquiry } from '../models/Enquiry';
import { Notice } from '../models/Notice';
import { Product } from '../models/Product';
import { StockAlert } from '../models/StockAlert';
import { Ticket } from '../models/Ticket';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { created, ok } from '../utils/response';
import { verifyAccessToken } from '../utils/jwt';

/* ============ Notification bell ============ */

/** Latest messages the admin broadcast to everyone; the app counts unseen ones itself. */
export const listNotices = asyncHandler(async (_req, res) => {
  const notices = await Notice.find().sort({ createdAt: -1 }).limit(30).lean();
  ok(res, notices);
});

/* ============ Notify me when back in stock ============ */

export const notifyMe = asyncHandler(async (req, res) => {
  const { phone } = req.body as { phone: string };
  const product = await Product.findById(req.params.id).select('_id').lean();
  if (!product) throw new ApiError(404, 'Product not found');

  // Signed-in customers are linked to the request; guests are fine too.
  let user: string | undefined;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      user = verifyAccessToken(header.slice(7)).sub;
    } catch {
      /* expired token - keep it anonymous */
    }
  }
  await StockAlert.updateOne(
    { product: product._id, phone },
    { $set: { notified: false, ...(user ? { user } : {}) } },
    { upsert: true },
  );
  ok(res, { message: 'Thank you, we will inform you once the product is available.' });
});

/* ============ Chat with customer care ============ */


export const listMyTickets = asyncHandler(async (req, res) => {
  const tickets = await Ticket.find({ user: req.user!.id }).sort({ lastMessageAt: -1 }).limit(50).lean();
  ok(res, tickets);
});

/** Unread admin replies across all of the customer's chats - the number on the menu badge. */
export const myUnreadCount = asyncHandler(async (req, res) => {
  const [row] = await Ticket.aggregate<{ count: number }>([
    { $match: { user: new Types.ObjectId(req.user!.id) } },
    { $group: { _id: null, count: { $sum: '$customerUnread' } } },
  ]);
  ok(res, { count: row?.count ?? 0 });
});

export const createTicket = asyncHandler(async (req, res) => {
  const { query, phone } = req.body as { query: string; phone: string };
  const ticket = await Ticket.create({
    user: req.user!.id,
    query,
    phone,
    messages: [{ from: 'customer', text: query, at: new Date() }],
    adminUnread: 1,
    lastMessageAt: new Date(),
  });
  created(res, {
    ticket,
    message: 'Your problem will be solved within a couple of hours or before, so keep checking here for more updates.',
  });
});

/** Opening a chat marks the admin's replies as read. */
export const getMyTicket = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findOneAndUpdate(
    { _id: req.params.id, user: req.user!.id },
    { $set: { customerUnread: 0 } },
    { new: true },
  ).lean();
  if (!ticket) throw new ApiError(404, 'Chat not found');
  ok(res, ticket);
});

export const replyMyTicket = asyncHandler(async (req, res) => {
  const { text } = req.body as { text: string };
  const ticket = await Ticket.findOneAndUpdate(
    { _id: req.params.id, user: req.user!.id },
    {
      $push: { messages: { from: 'customer', text, at: new Date() } },
      $inc: { adminUnread: 1 },
      $set: { status: 'open', lastMessageAt: new Date() },
    },
    { new: true },
  ).lean();
  if (!ticket) throw new ApiError(404, 'Chat not found');
  ok(res, ticket);
});

/* ============ Contact forms (city manager, invest, partners, ads, complaints) ============ */

export const createEnquiry = asyncHandler(async (req, res) => {
  const body = req.body as { kind: string; fullName: string; email: string; mobile: string; otherPhone?: string; reason: string };
  await Enquiry.create(body);
  created(res, { message: 'Thank you. Our team will contact you soon.' });
});
