/** GST maths for the bills. Prices in Autozo already include GST, so the tax is taken out of the price. */

export const STATE_CODES: Record<string, string> = {
  'jammu and kashmir': '01', 'himachal pradesh': '02', punjab: '03', chandigarh: '04', uttarakhand: '05', haryana: '06', delhi: '07', rajasthan: '08',
  'uttar pradesh': '09', bihar: '10', sikkim: '11', 'arunachal pradesh': '12', nagaland: '13', manipur: '14', mizoram: '15', tripura: '16', meghalaya: '17',
  assam: '18', 'west bengal': '19', jharkhand: '20', odisha: '21', chhattisgarh: '22', 'madhya pradesh': '23', gujarat: '24',
  'dadra and nagar haveli and daman and diu': '26', maharashtra: '27', karnataka: '29', goa: '30', lakshadweep: '31', kerala: '32', 'tamil nadu': '33',
  puducherry: '34', 'andaman and nicobar islands': '35', telangana: '36', 'andhra pradesh': '37', ladakh: '38',
};
const NAME_BY_CODE = Object.fromEntries(Object.entries(STATE_CODES).map(([n, c]) => [c, n]));
const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bAnd\b/g, 'and');

const norm = (s?: string) => (s ?? '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
const ALIASES: Record<string, string> = { orissa: 'odisha', uttaranchal: 'uttarakhand', pondicherry: 'puducherry', 'nct of delhi': 'delhi', 'new delhi': 'delhi', up: 'uttar pradesh', mp: 'madhya pradesh' };

/** { code: '09', name: 'Uttar Pradesh' } for a state name or a GSTIN ("09ABCDE1234F1Z5"). Unknown input gives null. */
export function resolveState(nameOrGstin?: string): { code: string; name: string } | null {
  const raw = (nameOrGstin ?? '').trim();
  if (/^\d{2}[A-Z0-9]{13}$/i.test(raw) && NAME_BY_CODE[raw.slice(0, 2)]) {
    const code = raw.slice(0, 2);
    return { code, name: titleCase(NAME_BY_CODE[code]) };
  }
  const n = ALIASES[norm(raw)] ?? norm(raw);
  const code = STATE_CODES[n];
  return code ? { code, name: titleCase(n) } : null;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface GstItemIn { name: string; unit?: string; quantity: number; price: number; mrp: number; lineTotal: number; hsn?: string; gstRate?: number }
export interface GstLine {
  name: string; unit?: string; hsn: string; quantity: number; mrp: number; price: number; gross: number; discount: number;
  rate: number; taxable: number; cgst: number; sgst: number; igst: number; total: number; isService: boolean;
}
export interface GstSummaryRow { hsn: string; rate: number; taxable: number; cgst: number; sgst: number; igst: number; tax: number }
export interface GstResult {
  lines: GstLine[]; summary: GstSummaryRow[];
  taxable: number; cgst: number; sgst: number; igst: number; tax: number; roundOff: number; grandTotal: number; interState: boolean;
}

export interface GstInput {
  items: GstItemIn[]; discount: number; deliveryFee: number; handlingFee: number; orderTotal: number;
  /** The charge for the chosen payment method (#36), e.g. "Debit card charges". */
  paymentFee?: number; paymentFeeLabel?: string;
  defaultRate: number; serviceRate: number; interState: boolean;
}

/** Splits `amount` (GST included) into taxable value and tax at `rate` %, CGST/SGST halves or one IGST. */
function split(amount: number, rate: number, interState: boolean) {
  const taxable = r2(amount / (1 + rate / 100));
  const tax = r2(amount - taxable);
  if (interState) return { taxable, cgst: 0, sgst: 0, igst: tax };
  const cgst = r2(tax / 2);
  return { taxable, cgst, sgst: r2(tax - cgst), igst: 0 };
}

export function computeGst(inp: GstInput): GstResult {
  const subtotal = r2(inp.items.reduce((s, i) => s + i.lineTotal, 0));
  // A coupon / discount lowers the value of the goods, so it is shared across the items by their value before tax is taken out.
  let left = Math.min(inp.discount > 0 ? inp.discount : 0, subtotal);
  const lines: GstLine[] = inp.items.map((i, idx) => {
    const share = idx === inp.items.length - 1 ? left : Math.min(left, r2((inp.discount > 0 ? inp.discount : 0) * (subtotal ? i.lineTotal / subtotal : 0)));
    left = r2(left - share);
    const net = r2(i.lineTotal - share);
    const rate = i.gstRate ?? inp.defaultRate;
    return { name: i.name, unit: i.unit, hsn: i.hsn || '', quantity: i.quantity, mrp: i.mrp, price: i.price, gross: i.lineTotal, discount: share, rate, ...split(net, rate, inp.interState), total: net, isService: false };
  });
  const service = (name: string, amount: number) => {
    if (amount <= 0) return;
    lines.push({ name, hsn: '9968', quantity: 1, mrp: amount, price: amount, gross: amount, discount: 0, rate: inp.serviceRate, ...split(amount, inp.serviceRate, inp.interState), total: amount, isService: true });
  };
  service('Delivery charge', inp.deliveryFee);
  service('Handling fee', inp.handlingFee);
  service(inp.paymentFeeLabel || 'Payment charges', inp.paymentFee ?? 0);

  const sum = (f: (l: GstLine) => number) => r2(lines.reduce((s, l) => s + f(l), 0));
  const taxable = sum((l) => l.taxable);
  const cgst = sum((l) => l.cgst);
  const sgst = sum((l) => l.sgst);
  const igst = sum((l) => l.igst);
  const grand = r2(taxable + cgst + sgst + igst);
  const roundOff = r2(inp.orderTotal - grand);

  const groups = new Map<string, GstSummaryRow>();
  for (const l of lines) {
    const key = `${l.hsn || '-'}|${l.rate}`;
    const g = groups.get(key) ?? { hsn: l.hsn || '-', rate: l.rate, taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0 };
    g.taxable = r2(g.taxable + l.taxable);
    g.cgst = r2(g.cgst + l.cgst);
    g.sgst = r2(g.sgst + l.sgst);
    g.igst = r2(g.igst + l.igst);
    g.tax = r2(g.cgst + g.sgst + g.igst);
    groups.set(key, g);
  }
  return {
    lines, summary: [...groups.values()].sort((a, b) => a.rate - b.rate || a.hsn.localeCompare(b.hsn)),
    taxable, cgst, sgst, igst, tax: r2(cgst + sgst + igst), roundOff, grandTotal: inp.orderTotal, interState: inp.interState,
  };
}
