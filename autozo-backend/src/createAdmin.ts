/**
 * One-off script to create (or promote) an admin-panel login.
 *
 * Usage:
 *   ADMIN_PASSWORD=MySecretPass123 npm run create-admin -- "Admin Name" 9876543210 admin@autozo.org
 *   # or omit ADMIN_PASSWORD and type it in when prompted (hidden)
 *
 * Phone is required (every user needs one); email + password are what you'll
 * actually log in to the admin panel with. The password is read from the
 * ADMIN_PASSWORD env var or a hidden prompt, never from the command line
 * (ISSUE-15). Re-running with the same phone or email updates the existing
 * account instead of making a duplicate.
 */
import { connectDB, disconnectDB } from './config/db';
import { User } from './models/User';
import { readSecret } from './utils/promptSecret';

async function main() {
  const [name, phone, email] = process.argv.slice(2);
  if (!name || !phone || !email) {
    console.error('Usage: ADMIN_PASSWORD=... npm run create-admin -- "Admin Name" 9876543210 admin@autozo.org');
    process.exit(1);
  }
  const password = await readSecret('ADMIN_PASSWORD', 'Admin password');
  if (!password) {
    console.error('A password is required (set ADMIN_PASSWORD or type it when prompted).');
    process.exit(1);
  }

  await connectDB();

  const existing = await User.findOne({ role: 'admin', $or: [{ phone }, { email: email.toLowerCase() }] });
  if (existing) {
    existing.name = name;
    existing.phone = phone;
    existing.email = email.toLowerCase();
    existing.password = password; // pre-save hook hashes it
    existing.role = 'admin';
    existing.isActive = true;
    await existing.save();
    console.log(`Updated existing user -> admin: ${existing.email} (${existing.phone})`);
  } else {
    const user = await User.create({ name, phone, email: email.toLowerCase(), password, role: 'admin' });
    console.log(`Created admin: ${user.email} (${user.phone})`);
  }

  await disconnectDB();
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to create admin:', err);
  process.exit(1);
});
