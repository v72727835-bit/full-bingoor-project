/**
 * Creates or updates a demo rider without changing existing catalog or orders.
 * The password is read from RIDER_PASSWORD or a hidden prompt, never from the
 * command line (ISSUE-15).
 *
 * Usage: RIDER_PASSWORD=Rider@12345 npm run create-rider -- "Demo Rider" 9111111111 rider.demo@autozo.org
 */
import { connectDB, disconnectDB } from './config/db';
import { Shop } from './models/Shop';
import { User } from './models/User';
import { readSecret } from './utils/promptSecret';

async function main() {
  const [name, phone, email] = process.argv.slice(2);
  if (!name || !phone || !email) {
    console.error('Usage: RIDER_PASSWORD=... npm run create-rider -- "Demo Rider" 9111111111 rider.demo@autozo.org');
    process.exit(1);
  }
  const password = await readSecret('RIDER_PASSWORD', 'Rider password');
  if (!password) {
    console.error('A password is required (set RIDER_PASSWORD or type it when prompted).');
    process.exit(1);
  }
  await connectDB();
  const warehouse = await Shop.findOne({ isActive: true }).sort({ createdAt: 1 }).select('_id name').lean();
  if (!warehouse) throw new Error('No active warehouse/shop found. Create a warehouse first.');

  const existing = await User.findOne({ role: 'rider', $or: [{ phone }, { email: email.toLowerCase() }] });
  if (existing) {
    existing.name = name;
    existing.phone = phone;
    existing.email = email.toLowerCase();
    existing.password = password;
    existing.role = 'rider';
    existing.warehouse = warehouse._id;
    existing.isActive = true;
    await existing.save();
    console.log(`Updated rider: ${email} (${phone}) -> ${warehouse.name}`);
  } else {
    await User.create({ name, phone, email: email.toLowerCase(), password, role: 'rider', warehouse: warehouse._id, isActive: true });
    console.log(`Created rider: ${email} (${phone}) -> ${warehouse.name}`);
  }
  await disconnectDB();
}

main().catch(async (err) => {
  console.error('Failed to create rider:', err);
  await disconnectDB();
  process.exit(1);
});