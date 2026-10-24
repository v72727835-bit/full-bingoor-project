import './env';
import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { Types } from 'mongoose';
import { deliverOrder, listOrders } from '../src/controllers/rider.controller';
import { freeRidersForOrder } from '../src/services/orderFlow.service';
import { deleteUserAdmin, listOrdersAdmin } from '../src/controllers/admin.controller';
import { Order } from '../src/models/Order';
import { User } from '../src/models/User';
import { DeviceToken } from '../src/models/DeviceToken';
import { adminShopBody, adminShopUpdateBody, riderDeliveryBody } from '../src/validators/schemas';

afterEach(() => mock.restoreAll());
const invoke = (handler: any, body = {}) => new Promise<any>((resolve) => {
  handler({ body, params: { id: '507f1f77bcf86cd799439011' }, user: { id: '507f1f77bcf86cd799439012' } }, {
    status() { return this; }, json(value: unknown) { resolve(value); },
  }, resolve);
});

test('warehouse create and edit allow radii above 100 km and reject invalid numbers', () => {
  for (const radius of [101, 250, 1000, 25000]) {
    assert.equal(adminShopBody.parse({ name: 'Warehouse', deliveryRadiusKm: radius }).deliveryRadiusKm, radius);
    assert.equal(adminShopUpdateBody.parse({ deliveryRadiusKm: radius }).deliveryRadiusKm, radius);
  }
  for (const radius of [0, -1, NaN, Infinity]) assert.equal(adminShopUpdateBody.safeParse({ deliveryRadiusKm: radius }).success, false);
});

test('OTP validation trims whitespace, preserves leading zeroes, rejects malformed codes', () => {
  assert.equal(riderDeliveryBody.parse({ otp: ' 0123 ' }).otp, '0123');
  for (const otp of ['', '123', '12345', '12a4', '12 34', 1234]) assert.equal(riderDeliveryBody.safeParse({ otp }).success, false);
});

test('matching delivery OTP proceeds to save the delivery, including legacy whitespace', async () => {
  for (const stored of ['0123', ' 0123 ']) {
    const saved = new Error('save reached');
    const order = { deliveryOtp: stored, status: 'out_for_delivery', statusHistory: [], save: async () => { throw saved; } };
    mock.method(Order, 'findOne', async (filter: any) => {
      assert.equal(filter.rider, '507f1f77bcf86cd799439012');
      assert.equal(filter.status, 'out_for_delivery');
      return order;
    });
    assert.equal(await invoke(deliverOrder, { otp: ' 0123 ' }), saved);
    assert.equal(order.status, 'delivered');
    mock.restoreAll();
  }
});

test('wrong or missing OTP never saves the order and identifies the order', async () => {
  for (const stored of ['1234', undefined]) {
    const save = mock.fn();
    mock.method(Order, 'findOne', async () => ({ deliveryOtp: stored, orderNumber: 'BG-TEST', save }));
    const error = await invoke(deliverOrder, { otp: '9999' });
    assert.match(error.message, /Incorrect delivery OTP for order BG-TEST/);
    assert.equal(save.mock.callCount(), 0);
    mock.restoreAll();
  }
});

test('an order not assigned to the rider cannot be delivered', async () => {
  mock.method(Order, 'findOne', async () => null);
  assert.match((await invoke(deliverOrder, { otp: '1234' })).message, /Active delivery not found/);
});

function rider() {
  mock.method(User, 'findById', () => ({ select: async () => ({ _id: new Types.ObjectId('507f1f77bcf86cd799439011'), role: 'rider', name: 'Rider' }) }) as any);
}
test('deleting a rider with an active delivery is blocked', async () => {
  rider();
  mock.method(Order, 'exists', async () => ({ _id: 'active' }) as any);
  const update = mock.method(User, 'updateOne', async () => ({}) as any);
  assert.match((await invoke(deleteUserAdmin)).message, /active deliveries/);
  assert.equal(update.mock.callCount(), 0);
});

test('deleting a rider holding COD cash is blocked', async () => {
  rider();
  mock.method(Order, 'exists', async () => null);
  mock.method(Order, 'aggregate', async () => [{ _id: '507f1f77bcf86cd799439011', pending: 100 }]);
  assert.match((await invoke(deleteUserAdmin)).message, /pending COD/);
});

test('deleting an eligible rider disables login while preserving order and wallet references', async () => {
  rider();
  mock.method(Order, 'exists', async () => null);
  mock.method(Order, 'aggregate', async () => []);
  const update = mock.method(User, 'updateOne', async (_filter: any, body: any) => {
    assert.equal(body.$set.isActive, false);
    assert.ok(body.$set.deletedAt instanceof Date);
    assert.deepEqual(body.$set.refreshTokens, []);
    return {} as any;
  });
  mock.method(DeviceToken, 'deleteMany', async () => ({}) as any);
  const remove = mock.method(User, 'deleteOne', async () => ({}) as any);
  await invoke(deleteUserAdmin);
  assert.equal(update.mock.callCount(), 1);
  assert.equal(remove.mock.callCount(), 0);
});

test('rider list keeps new pickups even when the rider has a long delivery history', async () => {
  const riderId = '507f1f77bcf86cd799439012';
  const warehouse = new Types.ObjectId();
  mock.method(User, 'findById', () => ({ select: () => ({ lean: async () => ({ warehouse, warehouses: [warehouse] }) }) }));
  const calls: { filter: any; sort: any; limit: number }[] = [];
  mock.method(Order, 'find', (filter: any) => {
    const call = { filter, sort: undefined as any, limit: 0 };
    calls.push(call);
    const q: any = {
      sort(s: any) { call.sort = s; return q; }, skip() { return q; }, limit(n: number) { call.limit = n; return q; },
      select() { return q; }, populate() { return q; },
      lean: async () => (filter.$or ? [{ _id: 'new-pickup', status: 'ready_for_pickup' }] : Array.from({ length: call.limit }, (_, i) => ({ _id: `old-${i}`, status: 'delivered' }))),
    };
    return q;
  });
  mock.method(Order, 'countDocuments', async () => 500);
  const body = await new Promise<any>((resolve, reject) => listOrders(
    { query: { page: 1, limit: 50 }, user: { id: riderId } } as any,
    { status() { return this; }, json: resolve } as any,
    reject,
  ));
  assert.equal(body.data[0]._id, 'new-pickup');
  assert.equal(body.data.length, 51);
  const open = calls.find((c) => c.filter.$or)!;
  assert.deepEqual(open.filter.shop, { $in: [warehouse] });
  assert.equal(calls.find((c) => c.filter.status === 'delivered')!.sort.createdAt, -1);
});

test('assignable riders include riders whose second warehouse is the order\'s', async () => {
  const shop = new Types.ObjectId();
  mock.method(Order, 'findById', () => ({ select: () => ({ lean: async () => ({ shop }) }) }));
  mock.method(Order, 'distinct', async () => []);
  let filter: any;
  mock.method(User, 'find', (f: any) => { filter = f; const q: any = { select: () => q, sort: () => q, lean: async () => [] }; return q; });
  await freeRidersForOrder(String(new Types.ObjectId()));
  assert.deepEqual(filter.$or, [{ warehouse: shop }, { warehouses: shop }]);
});

test('riders see an order as soon as the warehouse accepts it, until someone takes it', async () => {
  const warehouse = new Types.ObjectId();
  mock.method(User, 'findById', () => ({ select: () => ({ lean: async () => ({ warehouses: [warehouse] }) }) }));
  let open: any;
  mock.method(Order, 'find', (filter: any) => {
    if (filter.$or) open = filter;
    const q: any = { sort: () => q, skip: () => q, limit: () => q, select: () => q, populate: () => q, lean: async () => [] };
    return q;
  });
  mock.method(Order, 'countDocuments', async () => 0);
  await new Promise<any>((resolve, reject) => listOrders(
    { query: { page: 1, limit: 50 }, user: { id: '507f1f77bcf86cd799439012' } } as any,
    { status() { return this; }, json: resolve } as any,
    reject,
  ));
  assert.deepEqual(open.$or[0], { status: { $in: ['accepted', 'preparing', 'ready_for_pickup'] }, rider: { $exists: false } });
});

test('admin order list says how many riders can see a waiting order', async () => {
  const shop = new Types.ObjectId();
  const other = new Types.ObjectId();
  const now = new Date();
  const orders = [
    { _id: 'a', status: 'ready_for_pickup', shop: { _id: shop, name: 'sujata' } },
    { _id: 'b', status: 'accepted', shop: { _id: other, name: 'ansh' } },
    { _id: 'c', status: 'ready_for_pickup', shop: { _id: shop }, longDistance: true },
    { _id: 'd', status: 'out_for_delivery', shop: { _id: shop }, rider: { name: 'Ravi' } },
  ];
  mock.method(Order, 'find', () => { const q: any = { sort: () => q, skip: () => q, limit: () => q, select: () => q, populate: () => q, lean: async () => orders }; return q; });
  mock.method(Order, 'countDocuments', async () => orders.length);
  mock.method(User, 'find', () => ({ select: () => ({ lean: async () => [
    { warehouse: shop, lastSeenAt: now },
    { warehouse: other, warehouses: [shop], riderPaused: true },
  ] }) }));
  const body = await new Promise<any>((resolve, reject) => listOrdersAdmin(
    { query: { page: 1, limit: 50 } } as any,
    { status() { return this; }, json: resolve } as any,
    reject,
  ));
  const pool = Object.fromEntries(body.data.map((o: any) => [o._id, o.riderPool]));
  assert.deepEqual(pool.a, { linked: 2, canSee: 1, online: 1 });
  assert.deepEqual(pool.b, { linked: 0, canSee: 0, online: 0 });
  assert.deepEqual(pool.c, { linked: 2, canSee: 0, online: 0 });
  assert.equal(pool.d, undefined);
});
