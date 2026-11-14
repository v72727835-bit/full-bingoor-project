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

/*
 * Ordering for another location: the customer has a home address (default) and a
 * second address they set in the header. The order must go to the address they
 * chose, carrying that address's pin - which is what the rider navigates to -
 * not the default home.
 */
test('an order goes to the chosen address, not the default, and carries its pin for the rider', { timeout: 900000 }, async () => {
  const db = await MongoMemoryServer.create({ binary: { version: '8.2.6' }, instance: { launchTimeout: 60000 } });
  await mongoose.connect(db.getUri());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  try {
    const home = { lat: 24.70, lng: 83.07 };
    const friend = { lat: 26.85, lng: 75.80 }; // a different city, where the order is actually for
    const user = await User.create({ name: 'Buyer', phone: '9876543210', password: 'test-password', role: 'customer', addresses: [
      { label: 'home', name: 'Buyer', phone: '9876543210', line1: 'My house', city: 'Sonbhadra', state: 'UP', pincode: '231216', location: home, isDefault: true },
      { label: 'other', name: 'Friend', phone: '9999999999', line1: 'Friend flat', city: 'Jaipur', state: 'Rajasthan', pincode: '302020', location: friend, isDefault: false },
    ] });
    const shop = await Shop.create({ name: 'Jaipur WH', owner: user._id, deliveryRadiusKm: 25, location: { type: 'Point', coordinates: [75.802, 26.851] } });
    const category = await Category.create({ name: 'Dairy' });
    await Settings.create({ key: 'global' });
    const milk = await Product.create({ name: 'Milk', shop: shop._id, category: category._id, price: 40, mrp: 45, stock: 50 });
    await Cart.create({ user: user._id, items: [{ product: milk._id, quantity: 6 }] });
    const auth = { authorization: `Bearer ${signAccessToken(String(user._id), 'customer')}` };

    // The chosen address is the friend's (the non-default one set in the header).
    const friendId = String(user.addresses[1]._id);
    const res = await fetch(`${base}/orders`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ addressId: friendId, paymentMethod: 'cod' }) });
    assert.equal(res.status, 201, await res.clone().text());

    const order = await Order.findOne({ user: user._id }).lean();
    // The order carries the chosen address and its exact pin - the rider navigates here.
    assert.equal(order?.address.city, 'Jaipur', 'the order went to the chosen (friend) address, not home');
    assert.equal(order?.address.location?.lat, friend.lat);
    assert.equal(order?.address.location?.lng, friend.lng);
    assert.notEqual(order?.address.location?.lat, home.lat, 'not the default home pin');
  } finally {
    server.close();
    await mongoose.disconnect();
    await db.stop();
  }
});
