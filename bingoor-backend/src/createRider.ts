/** Creates or updates a demo rider without changing existing catalog or orders. */
import { connectDB, disconnectDB } from './config/db';
import { Shop } from './models/Shop';
import { User } from './models/User';

async function main() {
  const [name, phone, email, password] = process.argv.slice(2);
  if (!name || !phone || !email || !password) {
    console.error('Usage: npm run create-rider -- "Demo Rider" 9111111111 rider.demo@bingoor.com Rider@12345');
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