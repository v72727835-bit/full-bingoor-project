import { CartView, Product } from './types';

export function optimisticQuantity(view: CartView, id: string, requested: number, product?: Product): CartView {
  const existing = view.groups.flatMap((g) => g.items).find((i) => i.productId === id);
  const quantity = Math.max(0, Math.min(20, existing?.stock ?? product?.stock ?? 20, requested));
  let groups = view.groups.map((g) => ({ ...g, items: g.items.map((i) => i.productId === id
    ? { ...i, quantity, lineTotal: i.price * quantity } : i).filter((i) => i.quantity > 0) }));
  if (!existing && quantity > 0 && product) {
    const line = { productId: id, name: product.name, slug: product.slug, image: product.images[0],
      art: product.art, unit: product.unit, price: product.price, mrp: product.mrp, quantity,
      lineTotal: product.price * quantity, stock: product.stock, issue: null,
      codAvailable: product.codAvailable, onlineAvailable: product.onlineAvailable, deliveryDays: product.deliveryDays };
    const group = groups.find((g) => g.shop.id === product.shop?.id);
    if (group) group.items.push(line);
    else groups.push({ shop: { id: product.shop?.id ?? id, name: product.shop?.name ?? 'Your warehouse',
      slug: product.shop?.slug ?? '', logo: undefined, isOpen: product.shop?.isOpen ?? true, minOrderAmount: 0 },
      items: [line], subtotal: 0, deliveryFee: 0, total: 0, meetsMinOrder: true });
  }
  groups = groups.filter((g) => g.items.length).map((g) => {
    const subtotal = g.items.reduce((sum, i) => sum + i.lineTotal, 0);
    return { ...g, subtotal, total: subtotal + g.deliveryFee, meetsMinOrder: subtotal >= g.shop.minOrderAmount };
  });
  const subtotal = groups.reduce((sum, g) => sum + g.subtotal, 0);
  const deliveryFee = groups.reduce((sum, g) => sum + g.deliveryFee, 0);
  return { ...view, groups, subtotal, deliveryFee, total: subtotal + deliveryFee,
    itemCount: groups.reduce((sum, g) => sum + g.items.reduce((n, i) => n + i.quantity, 0), 0) };
}
