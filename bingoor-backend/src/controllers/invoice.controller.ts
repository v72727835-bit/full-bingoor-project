import { Request, Response } from 'express';
import { Order } from '../models/Order';
import { Settings } from '../models/Settings';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/response';
import { invoiceToken, invoiceTokenValid, renderInvoiceHtml } from '../services/invoice.service';
import { User } from '../models/User';
import { Product } from '../models/Product';
import { publicOrigin } from '../utils/publicUrl';
import { computeGst, resolveState } from '../services/gst';

const origin = (req: Request) => publicOrigin(req);

/** A 30-minute link that opens the bill in any browser, so the apps can hand it to the phone's browser to print or save. */
function linkResponse(req: Request, res: Response, orderId: string) {
  const { t, exp } = invoiceToken(orderId);
  const base = `${origin(req)}/api/v1/invoices/${orderId}`;
  const q = (format: string) => `${base}?format=${format}&exp=${exp}&t=${t}`;
  ok(res, { a4: q('a4'), pos: q('pos'), expiresAt: new Date(exp).toISOString() });
}

export const customerInvoiceLink = asyncHandler(async (req, res) => {
  const o = await Order.findOne({ _id: req.params.id, user: req.user!.id }).select('_id').lean();
  if (!o) throw new ApiError(404, 'Order not found');
  linkResponse(req, res, String(o._id));
});

export const adminInvoiceLink = asyncHandler(async (req, res) => {
  const o = await Order.findById(req.params.id).select('_id').lean();
  if (!o) throw new ApiError(404, 'Order not found');
  linkResponse(req, res, String(o._id));
});

export const sellerInvoiceLink = asyncHandler(async (req, res) => {
  const me = await User.findById(req.user!.id).select('sellerWarehouses').lean();
  const o = await Order.findOne({ _id: req.params.id, shop: { $in: me?.sellerWarehouses ?? [] } }).select('_id').lean();
  if (!o) throw new ApiError(404, 'Order not found');
  linkResponse(req, res, String(o._id));
});

/** The bill itself. Opened with the signed link, so no login is needed in the browser. */
export const renderInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params as { id: string };
  const { t, exp, format, print } = req.query as { t?: string; exp?: string; format?: string; print?: string };
  if (!t || !invoiceTokenValid(id, Number(exp), t)) throw new ApiError(401, 'This bill link has expired. Open the bill again from the app or panel.');

  const order = await Order.findById(id).populate('shop', 'name phone address gstin').lean();
  if (!order) throw new ApiError(404, 'Order not found');
  const settings = await Settings.findOne({ key: 'global' }).lean();
  const kind = format === 'pos' ? 'pos' : 'a4';
  const site = (settings?.company?.website && /^https?:\/\//i.test(settings.company.website) ? settings.company.website : 'https://bingoor.com').replace(/\/$/, '');

  // Orders made before GST was set up: take the HSN / rate from the product as it is now.
  const missing = order.items.filter((i) => i.gstRate === undefined || i.gstRate === null || !i.hsn).map((i) => i.product);
  const live = missing.length ? await Product.find({ _id: { $in: missing } }).select('hsn gstRate').lean() : [];
  const liveById = new Map(live.map((p) => [String(p._id), p]));
  const items = order.items.map((i) => {
    const p = liveById.get(String(i.product));
    return { ...i, hsn: i.hsn || p?.hsn || '', gstRate: i.gstRate ?? p?.gstRate ?? undefined };
  });

  const shop = typeof order.shop === 'object' ? (order.shop as unknown as { name?: string; phone?: string; gstin?: string; address?: { line1?: string; city?: string; state?: string; pincode?: string } }) : null;
  const company = settings?.company ?? {};
  const gstin = (shop?.gstin || company.gstin || '').toUpperCase();
  // Where the goods come from: the GSTIN's state, else the warehouse address, else the company's home state.
  const from = resolveState(gstin) ?? resolveState(shop?.address?.state) ?? resolveState(settings?.gst?.homeState) ?? resolveState('Uttar Pradesh')!;
  const to = resolveState(order.address.state);
  const interState = !!to && to.code !== from.code;
  const gst = computeGst({
    items, discount: order.discount ?? 0, deliveryFee: order.deliveryFee ?? 0, handlingFee: order.handlingFee ?? 0, orderTotal: order.total,
    paymentFee: order.paymentFee ?? 0, paymentFeeLabel: payFeeLabel(order.payOption), tip: order.tip ?? 0,
    defaultRate: settings?.gst?.defaultRate ?? 0, serviceRate: settings?.gst?.deliveryRate ?? 18, interState,
  });
  const shopAddress = shop?.address ? [shop.address.line1, shop.address.city, shop.address.state, shop.address.pincode].filter(Boolean).join(', ') : '';

  const html = renderInvoiceHtml(
    {
      order: order as never,
      shop: shop as never,
      company,
      social: (settings?.socialLinks ?? {}) as Record<string, string | undefined>,
      siteUrl: site,
      gst,
      supplier: { name: shop?.name || company.name || 'Bingoor', address: shopAddress || company.address || '', gstin, phone: shop?.phone || company.phone, stateText: `${from.name} (${from.code})` },
      placeOfSupply: to ? `${to.name} (${to.code})` : order.address.state || from.name,
    },
    kind,
    `format=${kind === 'pos' ? 'a4' : 'pos'}&exp=${exp}&t=${t}`,
    print === '1',
  );
  // This page carries its own tiny print script and loads the logo / seal from the uploads folder.
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' https: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
  res.setHeader('Cache-Control', 'no-store');
  res.type('html').send(html);
});

/** "Debit card charges", "Net banking charges"... for the bill line of the payment charge. */
function payFeeLabel(option?: string): string {
  const names: Record<string, string> = { upi: 'UPI', debit: 'Debit card', netbanking: 'Net banking', credit: 'Credit card', rupay: 'RuPay card', cod: 'Cash on delivery' };
  return `${names[option ?? ''] ?? 'Payment'} charges`;
}
