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
import { Order } from '../src/models/Order';
import { signAccessToken } from '../src/utils/jwt';

test('a product seller sees only product, quantity and payment of their own sales', { timeout: 900000 }, async () => {
  const db = await MongoMemoryServer.create({ binary: { version: '8.2.6' }, instance: { launchTimeout: 60000 } });
  await mongoose.connect(db.getUri());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  try {
    const admin = await User.create({ name: 'Admin', phone: '9000000001', password: 'test-password', role: 'admin' });
    const customer = await User.create({ name: 'Secret Customer', phone: '9000000002', password: 'test-password', role: 'customer' });
    const shop = await Shop.create({ name: 'Warehouse', owner: admin._id, deliveryRadiusKm: 20, location: { type: 'Point', coordinates: [83.07, 24.7] } });
    const category = await Category.create({ name: 'Dal' });
    const adminToken = signAccessToken(String(admin._id), 'admin');

    // The admin makes a product seller login.
    const made = await fetch(`${base}/admin/sellers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: 'Dal Seller', phone: '9000000003', password: 'seller-pass', warehouses: [String(shop._id)], kind: 'product' }),
    });
    assert.equal(made.status, 201);
    const sellerId = ((await made.json()) as { data: { _id: string } }).data._id;
    const warehouseLogin = await User.create({ name: 'Warehouse login', phone: '9000000004', password: 'test-password', role: 'seller', sellerWarehouses: [shop._id] });

    const mine = await Product.create({ name: 'Toor dal', shop: shop._id, category: category._id, price: 150, mrp: 180, stock: 10, seller: sellerId });
    const other = await Product.create({ name: 'Moong dal', shop: shop._id, category: category._id, price: 120, mrp: 140, stock: 10 });
    await Order.create({
      orderNumber: 'BG-1', checkoutId: 'c1', user: customer._id, shop: shop._id, sellerIds: [sellerId],
      items: [
        { product: mine._id, name: 'Toor dal', unit: '1 kg', price: 150, mrp: 180, quantity: 2, lineTotal: 300, seller: sellerId },
        { product: other._id, name: 'Moong dal', unit: '1 kg', price: 120, mrp: 140, quantity: 1, lineTotal: 120 },
      ],
      address: { name: 'Secret Customer', phone: '9000000002', line1: 'House 1', city: 'Robertsganj', state: 'UP', pincode: '231216' },
      paymentMethod: 'cod', subtotal: 420, deliveryFee: 0, total: 422, deliveryOtp: '1234', status: 'placed', statusHistory: [{ status: 'placed' }],
    });

    const sellerToken = signAccessToken(sellerId, 'seller');
    const get = (path: string, token = sellerToken) => fetch(`${base}${path}`, { headers: { authorization: `Bearer ${token}` } });

    const orders = await get('/seller/orders');
    assert.equal(orders.status, 200);
    const text = await orders.text();
    assert.ok(!text.includes('Secret Customer') && !text.includes('9000000002') && !text.includes('House 1'), 'no customer details');
    const rows = (JSON.parse(text) as { data: { items: { name: string; quantity: number }[]; amount: number; paymentMethod: string }[] }).data;
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0].items.map((i) => [i.name, i.quantity]), [['Toor dal', 2]]);
    assert.equal(rows[0].amount, 300);
    assert.equal(rows[0].paymentMethod, 'cod');

    // Only their own listings, and none of the warehouse tools.
    const products = (await (await get('/seller/products')).json()) as { data: { name: string }[] };
    assert.deepEqual(products.data.map((p) => p.name), ['Toor dal']);
    for (const path of ['/seller/customers', '/seller/riders', '/seller/shops', '/seller/dashboard']) assert.equal((await get(path)).status, 403, path);

    // The warehouse login still sees the whole order.
    const wh = await get('/seller/orders', signAccessToken(String(warehouseLogin._id), 'seller'));
    assert.ok((await wh.text()).includes('House 1'));
  } finally {
    server.close();
    await mongoose.disconnect();
    await db.stop();
  }
});
