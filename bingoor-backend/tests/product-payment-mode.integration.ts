import './env';
import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
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
import { Integrations } from '../src/models/Integrations';
import { invalidateIntegrations } from '../src/services/integrations.service';
import { productRules } from '../src/services/settings.service';
import { signAccessToken } from '../src/utils/jwt';
import { seal } from '../src/utils/secretBox';

test('product COD / online / both modes control cart, quotes and checkout at near and far addresses', { timeout: 900000 }, async () => {
  const db = await MongoMemoryServer.create({ binary: { version: '8.2.6' }, instance: { launchTimeout: 60000 } });
  await mongoose.connect(db.getUri());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  const originalFetch = globalThis.fetch;
  try {
    const user = await User.create({ name: 'COD Customer', phone: '9876543210', password: 'test-password', role: 'customer', addresses: [
      { label: 'home', name: 'Customer', phone: '9876543210', line1: 'Near address', city: 'Sonbhadra', state: 'UP', pincode: '231216', location: { lat: 24.701, lng: 83.071 } },
      { label: 'work', name: 'Customer', phone: '9876543210', line1: 'Far address', city: 'Varanasi', state: 'UP', pincode: '221001', location: { lat: 25.336, lng: 83.008 } },
    ] });
    const shop = await Shop.create({ name: 'COD Warehouse', owner: user._id, deliveryRadiusKm: 200, location: { type: 'Point', coordinates: [83.07, 24.7] } });
    const category = await Category.create({ name: 'Category with default COD off' });
    await Settings.create({ key: 'global', cod: { disabledCategories: [category._id] } });
    await Integrations.create({ key: 'global', razorpay: { keyId: 'rzp_test_fixture', keySecretEnc: seal('fixture-secret'), enabled: true } });
    invalidateIntegrations();
    const product = await Product.create({ name: 'Mustard oil', shop: shop._id, category: category._id, price: 220, mrp: 250, stock: 100, paymentMode: 'cod' });
    let gatewayCalls = 0;
    mock.method(globalThis, 'fetch', async (url: any, options: any) => {
      if (!String(url).startsWith('https://api.razorpay.com/')) return originalFetch(url, options);
      gatewayCalls++;
      return new Response(JSON.stringify({ id: `order_fixture_${gatewayCalls}`, amount: JSON.parse(options.body).amount, currency: 'INR' }), { status: 200 });
    });
    const request = async (path: string, body?: unknown) => {
      const response = await originalFetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${signAccessToken(String(user._id), user.role)}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, body: await response.json() as any };
    };
    const fillCart = () => Cart.updateOne({ user: user._id }, { $set: { items: [{ product: product._id, quantity: 10 }] } }, { upsert: true });
    for (const mode of ['cod', 'both', 'online'] as const) {
      await Product.updateOne({ _id: product._id }, { $set: { paymentMode: mode } });
      for (const [i, address] of user.addresses.entries()) {
        await fillCart();
        const cart = await request('/cart');
        const item = cart.body.data.groups[0].items[0];
        assert.equal(item.codAvailable, mode !== 'online', `${mode}: product setting must override category COD default`);
        assert.equal(item.onlineAvailable, mode !== 'cod');
        const quote = await request(`/cart/quote?addressId=${address._id}&slot=nextDay`);
        assert.equal(quote.body.data.longDistance, i === 1);
        // COD is off for an online-only product AND beyond the last distance band
        // (i === 1 here is past every band, so long-distance COD is refused).
        const codAllowed = mode !== 'online' && i !== 1;
        assert.equal(quote.body.data.codAllowed, codAllowed);
        assert.equal(quote.body.data.codMessage === undefined, i === 0 && mode !== 'online');
        const cod = await request('/orders', { addressId: String(address._id), paymentMethod: 'cod', slot: 'nextDay' });
        assert.equal(cod.status, codAllowed ? 201 : 409, JSON.stringify(cod.body));
        if (codAllowed) {
          assert.equal(cod.body.data.orders[0].paymentMethod, 'cod');
          assert.equal(cod.body.data.orders[0].longDistance, false);
        } else {
          // An online-only product refuses COD itself; otherwise the refusal is the long-distance rule.
          assert.equal(cod.body.details[0].reason, mode === 'online' ? 'cod_unavailable' : 'cod_long_distance');
        }
        await fillCart();
        const callsBefore = gatewayCalls;
        const online = await request('/orders', { addressId: String(address._id), paymentMethod: 'online', slot: 'nextDay' });
        assert.equal(online.status, mode === 'cod' ? 409 : 201, JSON.stringify(online.body));
        if (mode === 'cod') {
          assert.equal(online.body.details[0].reason, 'online_unavailable');
          assert.equal(gatewayCalls, callsBefore, 'COD-only products must never open a payment gateway order');
        } else assert.equal(online.body.data.requiresPayment, true);
      }
    }
    assert.equal(productRules(category._id).codAvailable, false, 'legacy products still inherit category defaults');
    // COD orders succeed only for cod/both products at the near address (the far
    // address is past the last band, so long-distance COD is refused): 2 orders.
    assert.equal(await Order.countDocuments(), 2);
    assert.equal((await Product.findById(product._id))?.stock, 80, 'only successful COD orders reserve stock');
  } finally {
    mock.restoreAll();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await mongoose.disconnect();
    await db.stop();
  }
});
