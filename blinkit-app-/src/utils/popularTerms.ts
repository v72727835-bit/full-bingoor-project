import { fetchCategoryTree, fetchProducts } from '../api/catalog';

/** A short, tappable term from a product name ("Bajaj Pulsar 150 Disc Brake" -> "Bajaj Pulsar 150"). */
const shortName = (name: string) => name.trim().split(/\s+/).slice(0, 3).join(' ');

/**
 * Search hints from what is really in the store: the best-selling in-stock
 * products and the top-level categories, interleaved. Loaded once per session
 * and shared by the home search bar and the search screen.
 */
let cache: Promise<string[]> | null = null;
export function loadPopularTerms(): Promise<string[]> {
  cache ??= Promise.all([
    fetchProducts({ sort: 'popular', inStock: true, limit: 10 }).then((r) => r.items.map((p) => shortName(p.name))).catch(() => [] as string[]),
    fetchCategoryTree().then((cats) => cats.map((c) => c.name)).catch(() => [] as string[]),
  ]).then(([products, categories]) => {
    const mixed: string[] = [];
    for (let i = 0; i < Math.max(products.length, categories.length); i++) {
      if (products[i]) mixed.push(products[i]);
      if (categories[i]) mixed.push(categories[i]);
    }
    const seen = new Set<string>();
    const out = mixed.filter((t) => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase())).slice(0, 12);
    if (!out.length) cache = null; // try again next time instead of keeping an empty list
    return out;
  });
  return cache;
}
