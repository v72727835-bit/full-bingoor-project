/**
 * Test data for the app smoke test (.github/workflows/app-e2e.yml), run after
 * `npm run seed` against a throwaway database: a rider for the first
 * warehouse and one COD order already out for delivery with that rider. The
 * order's delivery OTP is written to e2e-otp.txt for the rider-app script.
 */
import fs from 'node:fs';
import mongoose from 'mongoose';
import { env } from '../src/config/env';
import { Cart } from '../src/models/Cart';
import { Order } from '../src/models/Order';
import { Product } from '../src/models/Product';
import { Shop } from '../src/models/Shop';
import { User } from '../src/models/User';
import { signAccessToken } from '../src/utils/jwt';

const BASE = `http://127.0.0.1:${env.PORT}/api/v1`;

async function call(token: string, path: string, method = 'GET', body?: unknown) {
  const r = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await r.json()) as { data?: unknown; message?: string };
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${json.message ?? ''}`);
  return json.data as Record<string, unknown> | Record<string, unknown>[];
}

async function main() {
  await mongoose.connect(env.MONGO_URI);
  const customer = await User.findOne({ phone: '9876543210', role: 'customer' });
  const shop = await Shop.findOne().sort({ createdAt: 1 });
  if (!customer || !shop) throw new Error('Run `npm run seed` first.');
  const rider = await User.create({
    name: 'E2E Rider', phone: '9000000099', password: 'Rider@1234', role: 'rider', warehouse: shop._id, warehouses: [shop._id],
  });
  const product = await Product.findOne({ shop: shop._id, isActive: true, stock: { $gt: 5 } }).sort({ price: -1 });
  if (!product) throw new Error('No product in the first warehouse.');
  await Cart.findOneAndUpdate({ user: customer._id }, { $set: { items: [{ product: product._id, quantity: 5 }] } }, { upsert: true });

  const customerToken = signAccessToken(String(customer._id), 'customer');
  const address = customer.addresses.find((a) => a.isDefault) ?? customer.addresses[0];
  await call(customerToken, '/orders', 'POST', { addressId: String(address._id), paymentMethod: 'cod' });
  const order = await Order.findOne({ user: customer._id, shop: shop._id }).sort({ createdAt: -1 });
  if (!order) throw new Error('The order was not created.');
  await Order.updateOne({ _id: order._id }, { $set: { status: 'ready_for_pickup' } });
  await call(signAccessToken(String(rider._id), 'rider'), `/rider/orders/${order._id}/accept`, 'POST', {});
  const fresh = await Order.findById(order._id).lean();
  const otp = fresh?.deliveryOtp ?? '';
  fs.writeFileSync('e2e-otp.txt', otp);
  console.log(`Order ${fresh?.orderNumber} is ${fresh?.status} with rider 9000000099 / Rider@1234, delivery OTP ${otp}`);
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
