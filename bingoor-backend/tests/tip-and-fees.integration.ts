import './env';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import app from '../src/app';
import { User } from '../src/models/User';
import { Shop } from '../src/models/Shop';
import { Category } from '../src/models/Category';
import { Product } from '../src/models/Product';
import { Cart } from '../src/models/Cart';
import { Order } from '../src/models/Order';
import { Settings } from '../src/models/Settings';
import { signAccessToken } from '../src/utils/jwt';

test('the quote lists each payment charge and a tip is added to the order', { timeout: 900000 }, async () => {
  const db = await MongoMemoryServer.create({ binary: { version: '8.2.6' }, instance: { launchTimeout: 60000 } });
  await mongoose.connect(db.getUri());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  try {
    const user = await User.create({ name: 'Buyer', phone: '9876543210', password: 'test-password', role: 'customer', addresses: [
      { label: 'home', name: 'Buyer', phone: '9876543210', line1: 'Near', city: 'Sonbhadra', state: 'UP', pincode: '231216', location: { lat: 24.701, lng: 83.071 } },
    ] });
    const shop = await Shop.create({ name: 'Warehouse', owner: user._id, deliveryRadiusKm: 50, location: { type: 'Point', coordinates: [83.07, 24.7] } });
    const category = await Category.create({ name: 'Atta' });
    await Settings.create({ key: 'global' });
    const atta = await Product.create({ name: 'Atta', shop: shop._id, category: category._id, price: 1000, mrp: 1100, stock: 10 });
    await Cart.create({ user: user._id, items: [{ product: atta._id, quantity: 1 }] });
    const auth = { authorization: `Bearer ${signAccessToken(String(user._id), 'customer')}` };
    const addressId = String(user.addresses[0]._id);

    const q = (await (await fetch(`${base}/cart/quote?addressId=${addressId}`, { headers: auth })).json()) as { data: { total: number; paymentFees: Record<string, number> } };
    // 1000 items, free delivery near the warehouse, 2 handling = 1002.
    assert.equal(q.data.total, 1002);
    assert.equal(q.data.paymentFees.cod, 0);
    assert.equal(q.data.paymentFees.debit, 4.01);
    assert.equal(q.data.paymentFees.netbanking, 18.04);
    assert.equal(q.data.paymentFees.credit, 20.04);

    const res = await fetch(`${base}/orders`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ addressId, paymentMethod: 'cod', tip: 20 }) });
    assert.equal(res.status, 201, await res.clone().text());
    const order = await Order.findOne({ user: user._id }).lean();
    assert.equal(order?.tip, 20);
    assert.equal(order?.paymentFee, 0);
    assert.equal(order?.payOption, 'cod');
    assert.equal(order?.total, 1022);
  } finally {
    server.close();
    await mongoose.disconnect();
    await db.stop();
  }
});
