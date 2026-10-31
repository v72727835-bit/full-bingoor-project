import { Types } from 'mongoose';
import { z } from 'zod';
import { Category } from '../models/Category';
import { Product } from '../models/Product';
import { Shop } from '../models/Shop';

/**
 * Bulk product import for the super admin and the warehouse panel.
 *
 * The browser reads the CSV and sends plain rows; this checks every row on its
 * own, so one bad line never blocks the rest, and answers with a result per row
 * ("row 7: Category 'Aples' not found") the person can fix and upload again.
 */

export const MAX_BULK_ROWS = 300;

/** The columns a sheet may have, in the order the template lists them. */
export const BULK_COLUMNS = [
  'name',
  'category',
  'price',
  'mrp',
  'unit',
  'stock',
  'brand',
  'description',
  'images',
  'video',
  'foodType',
  'tags',
  'attributes',
  'variantGroup',
  'variantLabel',
  'nameHi',
  'warehouse',
  'points',
  'sortCode',
  'hsn',
  'gstRate',
  'payment',
] as const;

const blank = (v: unknown) => (v === undefined || v === null || String(v).trim() === '' ? undefined : String(v).trim());
const list = (v: unknown, sep = '|') =>
  (blank(v) ?? '')
    .split(sep)
    .map((s) => s.trim())
    .filter(Boolean);

const rowSchema = z.object({
  name: z.string().trim().min(2, 'name must be at least 2 characters').max(150),
  category: z.string().trim().min(1, 'category is required'),
  price: z.coerce.number({ invalid_type_error: 'price must be a number' }).min(0, 'price cannot be negative'),
  mrp: z.coerce.number({ invalid_type_error: 'mrp must be a number' }).min(0, 'mrp cannot be negative'),
  unit: z.string().trim().min(1).max(30).default('1 pc'),
  stock: z.coerce.number({ invalid_type_error: 'stock must be a number' }).int('stock must be a whole number').min(0).default(0),
  brand: z.string().trim().max(60).optional(),
  description: z.string().trim().max(2000).optional(),
  images: z.array(z.string().url('each image must be a full link starting with https://')).max(10, 'at most 10 images').default([]),
  video: z.string().trim().url('video must be a full link (YouTube or an mp4 file)').max(500).optional(),
  foodType: z.enum(['veg', 'nonveg', '']).default(''),
  tags: z.array(z.string().max(40)).max(15).default([]),
  attributes: z.array(z.string().max(40)).max(10).default([]),
  variantGroup: z.string().trim().max(60).optional(),
  variantLabel: z.string().trim().max(30).optional(),
  nameHi: z.string().trim().max(150).optional(),
  warehouse: z.string().trim().optional(),
  points: z.coerce.number().int().min(0).max(50).optional(),
  sortCode: z.coerce.number().int().min(0).max(1_000_000).optional(),
  hsn: z.string().trim().max(10).optional(),
  gstRate: z.coerce.number({ invalid_type_error: 'gstRate must be a number like 5, 12 or 18' }).min(0).max(28).optional(),
  paymentMode: z.enum(['both', 'cod', 'online'], { errorMap: () => ({ message: 'payment must be both, cod or online' }) }).default('both'),
});

export type RawRow = Record<string, unknown>;
export interface RowResult {
  /** 1-based sheet row (the header is row 1, so the first product is row 2). */
  row: number;
  name: string;
  ok: boolean;
  error?: string;
  id?: string;
}

export interface BulkContext {
  /** 'admin' may place products in any shop (by name); 'seller' only in `shopIds`. */
  mode: 'admin' | 'seller';
  sellerId?: string;
  /** Warehouses this seller owns. */
  shopIds?: string[];
  dryRun?: boolean;
}

/** "Non-Veg", "non veg" and "nonveg" all mean the same thing; anything unknown is left for the schema to reject. */
const foodTypeOf = (v: unknown): string => {
  const s = (blank(v) ?? '').toLowerCase().replace(/[^a-z]/g, '');
  if (s === 'veg' || s === 'vegetarian') return 'veg';
  if (s === 'nonveg' || s === 'nonvegetarian') return 'nonveg';
  return s;
};

const normaliseRow = (raw: RawRow): RawRow => ({
  ...raw,
  name: blank(raw.name),
  category: blank(raw.category),
  price: blank(raw.price),
  mrp: blank(raw.mrp) ?? blank(raw.price),
  unit: blank(raw.unit),
  stock: blank(raw.stock),
  brand: blank(raw.brand),
  description: blank(raw.description),
  images: list(raw.images),
  video: blank(raw.video),
  foodType: foodTypeOf(raw.foodType),
  tags: list(raw.tags),
  attributes: list(raw.attributes),
  variantGroup: blank(raw.variantGroup),
  variantLabel: blank(raw.variantLabel),
  nameHi: blank(raw.nameHi),
  warehouse: blank(raw.warehouse),
  points: blank(raw.points),
  sortCode: blank(raw.sortCode),
  hsn: blank(raw.hsn),
  gstRate: blank(raw.gstRate),
  paymentMode: paymentModeOf(raw.payment ?? raw.paymentMode),
});

/** "COD", "Online only", "both"... in any case; empty means both. */
const paymentModeOf = (v: unknown): string | undefined => {
  const s = (blank(v) ?? '').toLowerCase();
  if (!s) return undefined;
  if (s.startsWith('both') || s.includes('+') || s === 'any' || s === 'all') return 'both';
  if (s.startsWith('cod') || s.includes('cash')) return 'cod';
  if (s.startsWith('online') || s.startsWith('prepaid') || s.startsWith('upi')) return 'online';
  return s;
};

const problem = (e: z.ZodError) => e.issues.slice(0, 3).map((i) => i.message).join('; ');

export async function importProducts(rows: RawRow[], ctx: BulkContext): Promise<{ results: RowResult[]; created: number; failed: number }> {
  // Level-3 categories, found by name or by "Parent > Name" when a name is used twice.
  const cats = await Category.find({ level: 3, isActive: true }).populate('parent', 'name').select('name parent').lean();
  const byKey = new Map<string, string[]>();
  const add = (k: string, id: string) => byKey.set(k, [...(byKey.get(k) ?? []), id]);
  for (const c of cats) {
    const id = String(c._id);
    add(c.name.trim().toLowerCase(), id);
    const parent = (c.parent as unknown as { name?: string } | null)?.name;
    if (parent) add(`${parent.trim()} > ${c.name.trim()}`.toLowerCase(), id);
    add(id, id);
  }

  const shopFilter = ctx.mode === 'seller' ? { _id: { $in: (ctx.shopIds ?? []).map((s) => new Types.ObjectId(s)) } } : {};
  const shops = await Shop.find(shopFilter).select('name').lean();
  const shopByKey = new Map<string, string>();
  for (const s of shops) {
    shopByKey.set(s.name.trim().toLowerCase(), String(s._id));
    shopByKey.set(String(s._id), String(s._id));
  }
  const onlyShop = ctx.mode === 'seller' && shops.length === 1 ? String(shops[0]._id) : undefined;

  const results: RowResult[] = [];
  let createdCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNo = i + 2;
    const raw = rows[i] ?? {};
    const name = String(blank(raw.name) ?? '');
    const fail = (error: string) => results.push({ row: rowNo, name, ok: false, error });

    const parsed = rowSchema.safeParse(normaliseRow(raw));
    if (!parsed.success) {
      fail(problem(parsed.error));
      continue;
    }
    const r = parsed.data;
    if (r.mrp < r.price) {
      fail('mrp cannot be lower than price');
      continue;
    }

    const catIds = byKey.get(r.category.toLowerCase());
    if (!catIds?.length) {
      fail(`category '${r.category}' not found (use the exact name of a child category)`);
      continue;
    }
    if (new Set(catIds).size > 1) {
      fail(`category '${r.category}' matches more than one aisle; write it as 'Parent > ${r.category}'`);
      continue;
    }

    let shop: string | undefined;
    if (r.warehouse) {
      shop = shopByKey.get(r.warehouse.toLowerCase());
      if (!shop) {
        fail(ctx.mode === 'seller' ? `warehouse '${r.warehouse}' is not one of yours` : `shop '${r.warehouse}' not found`);
        continue;
      }
    } else if (onlyShop) {
      shop = onlyShop;
    } else {
      fail(ctx.mode === 'seller' ? 'warehouse is required (you have more than one)' : 'warehouse (shop name) is required');
      continue;
    }

    if (ctx.dryRun) {
      results.push({ row: rowNo, name: r.name, ok: true });
      createdCount++;
      continue;
    }

    try {
      const { warehouse: _w, category: _c, points, sortCode, ...rest } = r;
      const product = await Product.create({
        ...rest,
        shop,
        category: catIds[0],
        isActive: true,
        ...(ctx.mode === 'admin' ? { ...(points !== undefined ? { points } : {}), ...(sortCode !== undefined ? { sortCode } : {}) } : { seller: ctx.sellerId }),
      });
      results.push({ row: rowNo, name: r.name, ok: true, id: String(product._id) });
      createdCount++;
    } catch (err) {
      fail((err as Error).message || 'could not be saved');
    }
  }

  return { results, created: createdCount, failed: results.length - createdCount };
}
