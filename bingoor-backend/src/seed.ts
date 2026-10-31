/**
 * Loads the demo catalogue so the app has something real to show.
 *   npm run seed
 * WARNING: clears users, categories, shops, products, carts, orders and reviews
 * in the target database.
 */
import { CATALOG, SeedProduct } from './data/catalog';
import { artFor } from './data/productArt';
import { connectDB, disconnectDB } from './config/db';
import { Cart } from './models/Cart';
import { Category } from './models/Category';
import { Order } from './models/Order';
import { Product } from './models/Product';
import { Review } from './models/Review';
import { Shop } from './models/Shop';
import { User } from './models/User';

// Sample area: Robertsganj, Sonbhadra (lat, lng)
const BASE = { lat: 24.6905, lng: 83.0687 };

/**
 * Deterministic pseudo-random from a string, so re-seeding gives the same
 * ratings and stock instead of the catalogue shuffling under the customer.
 */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

async function main() {
  await connectDB();

  await Promise.all([
    User.deleteMany({}),
    Category.deleteMany({}),
    Shop.deleteMany({}),
    Product.deleteMany({}),
    Cart.deleteMany({}),
    Order.deleteMany({}),
    Review.deleteMany({}),
  ]);

  /* ---------------- users ---------------- */
  await User.create({
    name: 'Demo Customer',
    phone: '9876543210',
    email: 'customer@bingoor.test',
    password: 'Customer@123',
    role: 'customer',
    addresses: [
      {
        label: 'home',
        name: 'Demo Customer',
        phone: '9876543210',
        line1: '12, Station Road',
        landmark: 'Near Bus Stand',
        city: 'Robertsganj',
        state: 'Uttar Pradesh',
        pincode: '231216',
        location: { lat: BASE.lat + 0.004, lng: BASE.lng + 0.004 },
        isDefault: true,
      },
    ],
  });

  const owners = await User.create([
    { name: 'Bingoor Daily Owner', phone: '9000000001', password: 'Shop@1234', role: 'shop' },
    { name: 'Bingoor Fresh Owner', phone: '9000000002', password: 'Shop@1234', role: 'shop' },
    { name: 'Bingoor Bazaar Owner', phone: '9000000003', password: 'Shop@1234', role: 'shop' },
  ]);

  /* ---------------- shops ---------------- */
  const shops = await Shop.create([
    {
      name: 'Bingoor Daily',
      description: 'Everyday grocery, dairy and fresh produce delivered in minutes.',
      owner: owners[0]._id,
      phone: '9000000001',
      address: { line1: 'Main Market', city: 'Robertsganj', state: 'Uttar Pradesh', pincode: '231216' },
      location: { type: 'Point', coordinates: [BASE.lng, BASE.lat] },
      rating: 4.6,
      ratingCount: 2840,
      deliveryFee: 25,
      minOrderAmount: 99,
      deliveryRadiusKm: 9,
    },
    {
      name: 'Bingoor Fresh',
      description: 'Fruits, vegetables, meat and everything that has to arrive cold.',
      owner: owners[1]._id,
      phone: '9000000002',
      address: { line1: 'Civil Lines', city: 'Robertsganj', state: 'Uttar Pradesh', pincode: '231216' },
      location: { type: 'Point', coordinates: [BASE.lng + 0.012, BASE.lat + 0.009] },
      rating: 4.4,
      ratingCount: 1265,
      deliveryFee: 29,
      minOrderAmount: 149,
      deliveryRadiusKm: 10,
    },
    {
      name: 'Bingoor Bazaar',
      description: 'Beauty, electronics, home care and the things you did not plan to buy.',
      owner: owners[2]._id,
      phone: '9000000003',
      address: { line1: 'Ghorawal Road', city: 'Robertsganj', state: 'Uttar Pradesh', pincode: '231216' },
      location: { type: 'Point', coordinates: [BASE.lng - 0.014, BASE.lat + 0.006] },
      rating: 4.3,
      ratingCount: 806,
      deliveryFee: 35,
      minOrderAmount: 0,
      deliveryRadiusKm: 12,
    },
  ]);

  /** Groceries go to the grocery shops; everything else to the bazaar. */
  function shopFor(group: string, category: string) {
    if (group === 'Grocery & Kitchen') {
      const cold = ['Vegetables & Fruits', 'Dairy, Bread & Eggs', 'Chicken, Meat & Fish'];
      return cold.includes(category) ? shops[1]._id : shops[0]._id;
    }
    if (group === 'Snacks & Drinks') return shops[0]._id;
    return shops[2]._id;
  }

  /* ---------------- categories + products ---------------- */
  const productDocs: Record<string, unknown>[] = [];
  let groupOrder = 0;
  let stats = { groups: 0, categories: 0, children: 0, products: 0 };

  for (const group of CATALOG) {
    const groupDoc = await Category.create({
      name: group.name,
      icon: group.icon,
      level: 1,
      parent: null,
      sortOrder: ++groupOrder,
    });
    stats.groups++;

    let catOrder = 0;
    for (const category of group.categories) {
      const catDoc = await Category.create({
        name: category.name,
        icon: category.icon,
        tint: category.tint,
        level: 2,
        parent: groupDoc._id,
        sortOrder: ++catOrder,
      });
      stats.categories++;

      let childOrder = 0;
      for (const child of category.children) {
        const childDoc = await Category.create({
          name: child.name,
          icon: child.icon,
          tint: category.tint,
          level: 3,
          parent: catDoc._id,
          sortOrder: ++childOrder,
        });
        stats.children++;

        for (const row of child.products) {
          const [name, brand, price, mrp, unit, foodType, attributes] = row as SeedProduct;
          const r = hash(name);
          productDocs.push({
            shop: shopFor(group.name, category.name),
            category: childDoc._id,
            name,
            brand,
            price,
            mrp,
            unit,
            foodType,
            attributes: attributes ?? [],
            icon: artFor(name, brand, child.icon),
            images: [],
            // One product in ~40 is out of stock, so the empty states get exercised.
            stock: r < 0.025 ? 0 : 12 + Math.round(r * 180),
            rating: Math.round((3.7 + r * 1.2) * 10) / 10,
            ratingCount: 40 + Math.round(r * 9600),
            soldCount: Math.round(r * 900),
            tags: [brand.toLowerCase(), child.name.toLowerCase(), category.name.toLowerCase()],
            description: `${name} from ${brand}. ${unit} pack, delivered fresh from your nearest Bingoor store.`,
          });
          stats.products++;
        }
      }
    }
  }

  await Product.insertMany(productDocs);

  console.log('\nSeed complete.');
  console.log(`  groups ${stats.groups}  categories ${stats.categories}  sub-categories ${stats.children}  products ${stats.products}`);
  console.log('\nCustomer login : phone 9876543210 / password Customer@123');
  console.log('Shop owners    : 9000000001-3 / password Shop@1234 (for the future shop portal)');
  console.log(`Sample location: lat=${BASE.lat} lng=${BASE.lng}\n`);

  await disconnectDB();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDB();
  process.exit(1);
});
