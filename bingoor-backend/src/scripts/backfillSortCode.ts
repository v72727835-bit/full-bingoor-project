/**
 * One-off migration: give legacy products a default sortCode so the default
 * browse sort ({ sortCode, name }) behaves. Previously this ran on every server
 * boot (ISSUE-09), scanning the whole collection and delaying health checks.
 *
 * Run with: npm run migrate:sort-code
 */
import { connectDB, disconnectDB } from '../config/db';
import { Product } from '../models/Product';

async function main() {
  await connectDB();
  const res = await Product.updateMany({ sortCode: { $exists: false } }, { $set: { sortCode: 1_000_000 } });
  console.log(`sortCode backfill: matched ${res.matchedCount}, updated ${res.modifiedCount}`);
  await disconnectDB();
}

main().catch((err) => {
  console.error('sortCode backfill failed:', err);
  process.exit(1);
});
