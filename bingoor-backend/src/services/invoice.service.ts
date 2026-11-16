import crypto from 'crypto';
import { env } from '../config/env';
import { code128Svg, qrSvg } from './barcode';
import type { GstResult } from './gst';

/* ---------- short-lived signed links, so a bill opens in any browser or app without a login ---------- */

const sign = (orderId: string, exp: number) =>
  crypto.createHmac('sha256', env.JWT_ACCESS_SECRET).update(`invoice:${orderId}:${exp}`).digest('hex').slice(0, 32);

export function invoiceToken(orderId: string, ttlMs = 30 * 60 * 1000) {
  const exp = Date.now() + ttlMs;
  return { exp, t: sign(orderId, exp) };
}

export function invoiceTokenValid(orderId: string, exp: number, t: string): boolean {
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const good = Buffer.from(sign(orderId, exp));
  const given = Buffer.from(String(t));
  return good.length === given.length && crypto.timingSafeEqual(good, given);
}

/* ---------- helpers ---------- */

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
const inr = (n: number) => `₹${(Math.round((n + Number.EPSILON) * 100) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const safeUrl = (u?: string) => (u && /^https?:\/\//i.test(u) ? u : '');
const dateText = (d: Date) =>
  new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function below1000(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : ''));
  } else if (n > 0) parts.push(ONES[n]);
  return parts.join(' ');
}
/** 1234.5 -> "Rupees One Thousand Two Hundred Thirty Four and Fifty Paise Only" (Indian grouping). */
export function amountInWords(amount: number): string {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  if (rupees === 0 && paise === 0) return 'Rupees Zero Only';
  const crore = Math.floor(rupees / 10_000_000);
  const lakh = Math.floor((rupees % 10_000_000) / 100_000);
  const thousand = Math.floor((rupees % 100_000) / 1000);
  const rest = rupees % 1000;
  const words = [
    crore ? `${below1000(crore)} Crore` : '',
    lakh ? `${below1000(lakh)} Lakh` : '',
    thousand ? `${below1000(thousand)} Thousand` : '',
    rest ? below1000(rest) : '',
  ].filter(Boolean).join(' ');
  return `Rupees ${words || 'Zero'}${paise ? ` and ${below1000(paise)} Paise` : ''} Only`;
}

/* ---------- data the template needs ---------- */

export interface InvoiceCompany {
  name?: string; tagline?: string; address?: string; phone?: string; email?: string; website?: string; gstin?: string; fssai?: string;
  logo?: string; signature?: string; seal?: string; signatoryName?: string; signatoryTitle?: string; declaration?: string; footerNote?: string;
}
export interface InvoiceData {
  order: {
    _id: unknown; orderNumber: string; createdAt: Date; paymentMethod: string; paymentStatus: string; status: string;
    subtotal: number; deliveryFee: number; handlingFee?: number; discount: number; total: number; note?: string;
    items: { name: string; unit?: string; price: number; mrp: number; quantity: number; lineTotal: number }[];
    address: { name: string; phone: string; line1: string; line2?: string; landmark?: string; city: string; state: string; pincode: string };
  };
  shop?: { name?: string; phone?: string; address?: { line1?: string; city?: string; state?: string; pincode?: string } } | null;
  company: InvoiceCompany;
  social: Record<string, string | undefined>;
  siteUrl: string;
  gst: GstResult;
  /** Who supplies the goods: the warehouse (with its own GSTIN) or, failing that, the company. */
  supplier: { name: string; address: string; gstin: string; phone?: string; stateText: string; dispatchedFrom?: string };
  /** The customer's GSTIN from their profile, if they added one. */
  buyerGstin?: string;
  placeOfSupply: string;
}

const DEFAULT_DECLARATION = 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.';
const SOCIAL: { key: string; label: string; icon: string }[] = [
  { key: 'facebook', label: 'Facebook', icon: 'f' },
  { key: 'instagram', label: 'Instagram', icon: 'ig' },
  { key: 'youtube', label: 'YouTube', icon: '▶' },
  { key: 'whatsapp', label: 'WhatsApp', icon: 'wa' },
  { key: 'x', label: 'X', icon: 'X' },
  { key: 'telegram', label: 'Telegram', icon: 'tg' },
  { key: 'linkedin', label: 'LinkedIn', icon: 'in' },
];
const shortLink = (u: string) => u.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');

function socialHtml(social: Record<string, string | undefined>, compact: boolean): string {
  const items = SOCIAL.filter((s) => safeUrl(social[s.key]));
  if (!items.length) return '';
  return `<div class="social${compact ? ' compact' : ''}">${items
    .map((s) => `<span class="soc"><i>${esc(s.icon)}</i>${esc(compact ? s.label : shortLink(social[s.key]!))}</span>`)
    .join('')}</div>`;
}

function addressLines(a: InvoiceData['order']['address']) {
  return [a.line1, a.line2, a.landmark ? `Near ${a.landmark}` : '', [a.city, a.state].filter(Boolean).join(', '), a.pincode].filter(Boolean).map(esc).join('<br>');
}

const BASE_CSS = `
*{box-sizing:border-box}body{margin:0;background:#e9edf2;font-family:'Segoe UI',Roboto,Arial,sans-serif;color:#111827;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.bar{position:sticky;top:0;z-index:5;background:#0f172a;color:#fff;padding:10px 14px;display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap}
.bar a,.bar button{background:#16a34a;color:#fff;border:0;border-radius:8px;padding:9px 16px;font-size:14px;font-weight:600;text-decoration:none;cursor:pointer}
.bar a.alt{background:#334155}
.social{display:flex;flex-wrap:wrap;gap:6px 14px;justify-content:center;font-size:11px;color:#374151}
.soc{display:inline-flex;align-items:center;gap:5px}.soc i{display:inline-flex;align-items:center;justify-content:center;min-width:16px;height:16px;border-radius:50%;background:#111827;color:#fff;font:700 8px/1 Arial;font-style:normal;padding:0 3px}
.seal{position:absolute;opacity:.92;transform:rotate(-8deg);mix-blend-mode:multiply}
`;

/* ---------- A4 tax invoice ---------- */

function taxHead(g: GstResult) {
  return g.interState ? ['IGST'] : ['CGST', 'SGST'];
}
const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2)}%`;

function a4(d: InvoiceData): string {
  const { order: o, company: c, gst: g } = d;
  const name = c.name || 'Bingoor';
  const logo = safeUrl(c.logo);
  const sign = safeUrl(c.signature);
  const seal = safeUrl(c.seal);
  const hasTax = g.tax > 0;
  const heads = taxHead(g);
  const saved = o.items.reduce((s, i) => s + Math.max(0, (i.mrp - i.price) * i.quantity), 0) + Math.max(0, o.discount);
  const rows = g.lines
    .map((l, n) => {
      const taxCells = g.interState
        ? `<td class="r">${l.rate ? pct(l.rate) : '0%'}<div class="mut">${inr(l.igst)}</div></td>`
        : `<td class="r">${l.rate ? pct(l.rate / 2) : '0%'}<div class="mut">${inr(l.cgst)}</div></td><td class="r">${l.rate ? pct(l.rate / 2) : '0%'}<div class="mut">${inr(l.sgst)}</div></td>`;
      return `<tr><td class="c">${n + 1}</td><td>${esc(l.name)}${l.unit ? `<div class="mut">${esc(l.unit)}</div>` : ''}${l.discount > 0 ? `<div class="mut">Discount - ${inr(l.discount)}</div>` : ''}</td><td class="c">${esc(l.hsn || '-')}</td><td class="c">${l.isService ? '1' : l.quantity}</td><td class="r">${l.isService ? '-' : inr(l.price)}</td><td class="r">${inr(l.taxable)}</td>${taxCells}<td class="r b">${inr(l.total)}</td></tr>`;
    })
    .join('');
  const sumRows = g.summary
    .map((s) => `<tr><td class="c">${esc(s.hsn)}</td><td class="r">${inr(s.taxable)}</td>${g.interState ? `<td class="r">${pct(s.rate)}</td><td class="r">${inr(s.igst)}</td>` : `<td class="r">${pct(s.rate / 2)}</td><td class="r">${inr(s.cgst)}</td><td class="r">${pct(s.rate / 2)}</td><td class="r">${inr(s.sgst)}</td>`}<td class="r b">${inr(s.tax)}</td></tr>`)
    .join('');
  const totalRows = [
    ['Total taxable value', inr(g.taxable)],
    ...(g.interState ? [['IGST', inr(g.igst)]] : [['CGST', inr(g.cgst)], ['SGST', inr(g.sgst)]]),
    ...(Math.abs(g.roundOff) >= 0.01 ? [['Round off', `${g.roundOff < 0 ? '- ' : ''}${inr(Math.abs(g.roundOff))}`]] : []),
  ]
    .map(([k, v]) => `<div class="tr"><span>${k}</span><span>${v}</span></div>`)
    .join('');
  const pay = o.paymentMethod === 'cod' ? 'Cash on delivery' : `Online (${o.paymentStatus})`;
  const orderUrl = `${d.siteUrl}/orders/${String(o._id)}`;
  const sup = d.supplier;
  const title = c.gstin || sup.gstin ? 'TAX INVOICE' : 'INVOICE';

  return `<style>${BASE_CSS}
@page{size:A4;margin:8mm}
.sheet{width:210mm;min-height:297mm;margin:16px auto;background:#fff;padding:10mm 10mm 8mm;box-shadow:0 6px 30px rgba(0,0,0,.18);position:relative}
.head{display:flex;justify-content:space-between;gap:16px;border-bottom:3px solid #16a34a;padding-bottom:10px}
.brand{display:flex;gap:12px;align-items:center}.brand img{height:62px;max-width:150px;object-fit:contain}
.brand h1{margin:0;font-size:21px;color:#0f172a}.brand p{margin:2px 0;font-size:11px;color:#4b5563;line-height:1.35}
.title{text-align:right}.title h2{margin:0;font-size:23px;letter-spacing:2px;color:#16a34a}.title p{margin:3px 0;font-size:11.5px}
.meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:10px 0}
.box{border:1px solid #e5e7eb;border-radius:8px;padding:8px 10px;font-size:11.5px;line-height:1.5;background:#fafafa}
.box h4{margin:0 0 4px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#16a34a}
table{width:100%;border-collapse:collapse;font-size:10.5px}th{background:#0f172a;color:#fff;padding:6px 5px;text-align:left;font-size:9.5px}
td{padding:6px 5px;border-bottom:1px solid #e5e7eb;vertical-align:top}.c{text-align:center}.r{text-align:right}.b{font-weight:700}.mut{color:#6b7280;font-size:9.5px}
.sum{margin-top:10px;width:62%}.sum th{background:#334155}
.foot{display:grid;grid-template-columns:1fr 250px;gap:18px;margin-top:10px}
.tr{display:flex;justify-content:space-between;padding:4px 0;font-size:12px;border-bottom:1px dashed #e5e7eb}
.grand{display:flex;justify-content:space-between;background:#16a34a;color:#fff;border-radius:8px;padding:9px 12px;margin-top:8px;font-size:16px;font-weight:800}
.words{font-size:11px;margin-top:8px}.save{margin-top:6px;font-size:11.5px;color:#15803d;font-weight:700}
.codes{display:flex;gap:14px;align-items:center}.codes .bc{flex:1;text-align:center}
.decl{margin-top:12px;border:1px dashed #9ca3af;border-radius:8px;padding:8px 10px;font-size:10.5px;color:#374151;line-height:1.5}
.sigrow{display:flex;justify-content:space-between;align-items:flex-end;margin-top:14px;position:relative;min-height:118px}
.sigbox{text-align:center;width:230px;position:relative}.sigbox img.sig{height:56px;max-width:200px;object-fit:contain}
.sigline{border-top:1px solid #111827;margin-top:4px;padding-top:4px;font-size:11px}
.seal{width:112px;height:112px;object-fit:contain;right:255px;bottom:2px}
.note{margin-top:8px;text-align:center;font-size:10.5px;color:#4b5563}.thanks{margin-top:8px;text-align:center;font-weight:700;font-size:12.5px;color:#16a34a}
@media print{body{background:#fff}.bar{display:none}.sheet{margin:0;box-shadow:none;width:auto;min-height:0;padding:0}}
@media (max-width:820px){.sheet{width:auto;margin:0;padding:10px;overflow-x:auto}.meta{grid-template-columns:1fr}.foot{grid-template-columns:1fr}.head{flex-direction:column}.title{text-align:left}.sum{width:100%}.seal{right:40px}table{min-width:640px}}
</style>
<div class="bar"><button onclick="window.print()">Print / Save as PDF</button><a class="alt" href="?{ALT}">POS (thermal) bill</a></div>
<div class="sheet">
 <div class="head">
  <div class="brand">${logo ? `<img src="${esc(logo)}" alt="${esc(name)}">` : ''}<div><h1>${esc(name)}</h1>${c.tagline ? `<p><b>${esc(c.tagline)}</b></p>` : ''}${c.address ? `<p>${esc(c.address)}</p>` : ''}<p>${[c.phone ? `Ph: ${esc(c.phone)}` : '', c.email ? esc(c.email) : '', c.website ? esc(c.website) : ''].filter(Boolean).join(' &nbsp;|&nbsp; ')}</p>${c.gstin || c.fssai ? `<p>${[c.gstin ? `<b>GSTIN:</b> ${esc(c.gstin)}` : '', c.fssai ? `<b>FSSAI:</b> ${esc(c.fssai)}` : ''].filter(Boolean).join(' &nbsp;|&nbsp; ')}</p>` : ''}</div></div>
  <div class="title"><h2>${title}</h2><p><b>Invoice no:</b> ${esc(o.orderNumber)}</p><p><b>Date:</b> ${esc(dateText(o.createdAt))}</p><p><b>Payment:</b> ${esc(pay)}</p><p><b>Reverse charge:</b> No</p></div>
 </div>
 <div class="meta">
  <div class="box"><h4>Bill to</h4><b>${esc(o.address.name)}</b>${d.buyerGstin ? `<br><b>GSTIN:</b> ${esc(d.buyerGstin)}` : ''}<br>${esc(o.address.phone)}<br>${addressLines(o.address)}</div>
  <div class="box"><h4>Sold by</h4><b>${esc(sup.name)}</b><br>${esc(sup.address)}${sup.phone ? `<br>${esc(sup.phone)}` : ''}${sup.gstin ? `<br><b>GSTIN:</b> ${esc(sup.gstin)}` : ''}${sup.stateText ? `<br>State: ${esc(sup.stateText)}` : ''}${sup.dispatchedFrom ? `<br><span class="mut">Dispatched from: ${esc(sup.dispatchedFrom)}</span>` : ''}</div>
  <div class="box"><h4>Place of supply</h4><b>${esc(d.placeOfSupply)}</b><br>${g.interState ? 'Inter-state supply (IGST)' : 'Intra-state supply (CGST + SGST)'}${o.note ? `<br><span class="mut">Note: ${esc(o.note)}</span>` : ''}</div>
 </div>
 <table><thead><tr><th class="c" style="width:26px">#</th><th>Description of goods / services</th><th class="c" style="width:52px">HSN/SAC</th><th class="c" style="width:34px">Qty</th><th class="r" style="width:58px">Rate (incl. GST)</th><th class="r" style="width:64px">Taxable value</th>${heads.map((h) => `<th class="r" style="width:62px">${h}</th>`).join('')}<th class="r" style="width:70px">Amount</th></tr></thead><tbody>${rows}</tbody></table>
 ${hasTax ? `<table class="sum"><thead><tr><th class="c">HSN/SAC</th><th class="r">Taxable value</th>${g.interState ? '<th class="r">IGST rate</th><th class="r">IGST amt</th>' : '<th class="r">CGST rate</th><th class="r">CGST amt</th><th class="r">SGST rate</th><th class="r">SGST amt</th>'}<th class="r">Total tax</th></tr></thead><tbody>${sumRows}<tr><td class="b c">Total</td><td class="r b">${inr(g.taxable)}</td>${g.interState ? `<td></td><td class="r b">${inr(g.igst)}</td>` : `<td></td><td class="r b">${inr(g.cgst)}</td><td></td><td class="r b">${inr(g.sgst)}</td>`}<td class="r b">${inr(g.tax)}</td></tr></tbody></table>` : ''}
 <div class="foot">
  <div>
   <div class="codes"><div class="bc">${code128Svg(o.orderNumber, { height: 44 })}</div><div>${qrSvg(orderUrl, 80)}<div class="mut" style="text-align:center">Scan for order</div></div></div>
   <div class="words"><b>Amount in words:</b> ${esc(amountInWords(o.total))}</div>
   ${hasTax ? `<div class="words"><b>Tax amount in words:</b> ${esc(amountInWords(g.tax))}</div>` : ''}
  </div>
  <div>${totalRows}<div class="grand"><span>Grand total</span><span>${inr(o.total)}</span></div>${saved > 0 ? `<div class="save">You saved ${inr(saved)} on this order</div>` : ''}</div>
 </div>
 <div class="decl"><b>Declaration:</b> ${esc(c.declaration || DEFAULT_DECLARATION)}</div>
 <div class="sigrow">
  <div class="mut" style="max-width:300px">${c.footerNote ? esc(c.footerNote) : 'This is a computer generated invoice.'}</div>
  ${seal ? `<img class="seal" src="${esc(seal)}" alt="Company seal">` : ''}
  <div class="sigbox"><div class="mut">For ${esc(name)}</div>${sign ? `<img class="sig" src="${esc(sign)}" alt="Signature">` : '<div style="height:56px"></div>'}<div class="sigline"><b>${esc(c.signatoryName || 'Authorised Signatory')}</b>${c.signatoryTitle ? `<br>${esc(c.signatoryTitle)}` : ''}</div></div>
 </div>
 <div class="thanks">Thank you for shopping with ${esc(name)}!</div>
 ${socialHtml(d.social, false)}
</div>`;
}

/* ---------- POS (80 mm thermal) bill ---------- */

function pos(d: InvoiceData): string {
  const { order: o, company: c } = d;
  const name = c.name || 'Bingoor';
  const logo = safeUrl(c.logo);
  const sign = safeUrl(c.signature);
  const seal = safeUrl(c.seal);
  const line = (k: string, v: string, bold = false) => `<div class="ln${bold ? ' bd' : ''}"><span>${k}</span><span>${v}</span></div>`;
  const g = d.gst;
  const items = g.lines
    .map((l) => `<div class="it"><div class="nm">${esc(l.name)}${l.unit ? ` <span class="m">(${esc(l.unit)})</span>` : ''}</div><div class="ln"><span>${l.isService ? '' : `${l.quantity} × ${inr(l.price)} `}<span class="m">${l.hsn ? `HSN ${esc(l.hsn)} · ` : ''}GST ${pct(l.rate)}</span></span><span>${inr(l.total)}</span></div></div>`)
    .join('');
  const taxLines = g.tax > 0
    ? `${line('Taxable value', inr(g.taxable))}${g.interState ? line('IGST', inr(g.igst)) : `${line('CGST', inr(g.cgst))}${line('SGST', inr(g.sgst))}`}${Math.abs(g.roundOff) >= 0.01 ? line('Round off', `${g.roundOff < 0 ? '- ' : ''}${inr(Math.abs(g.roundOff))}`) : ''}`
    : '';
  const sumRows = g.tax > 0
    ? `<div class="hr"></div><div class="m"><b>GST summary</b></div>${g.summary.map((s) => `<div class="ln m"><span>${esc(s.hsn)} @ ${pct(s.rate)}</span><span>${inr(s.taxable)} + ${inr(s.tax)}</span></div>`).join('')}`
    : '';
  const pay = o.paymentMethod === 'cod' ? 'Cash on delivery' : `Online (${o.paymentStatus})`;
  return `<style>${BASE_CSS}
@page{size:80mm auto;margin:3mm}
.rc{width:80mm;margin:14px auto;background:#fff;padding:5mm 4mm;font-size:11.5px;line-height:1.35;box-shadow:0 6px 30px rgba(0,0,0,.18);position:relative}
.rc .ctr{text-align:center}.rc img.logo{height:46px;max-width:60mm;object-fit:contain}
.rc h1{margin:4px 0 0;font-size:16px}.m{color:#555;font-size:10px}
.hr{border-top:1px dashed #000;margin:6px 0}.ln{display:flex;justify-content:space-between;gap:6px}.bd{font-weight:800;font-size:14px}
.nm{font-weight:600}.it{margin:3px 0}
.rc .signrow{display:flex;justify-content:space-between;align-items:flex-end;margin-top:8px;position:relative;min-height:62px}
.rc .signrow img.sig{height:34px;max-width:34mm;object-fit:contain}.rc .seal{position:static;width:62px;height:62px;object-fit:contain;transform:rotate(-8deg)}
.rc .social{font-size:9px;gap:3px 8px;margin-top:6px}
@media print{body{background:#fff}.bar{display:none}.rc{margin:0;box-shadow:none;width:auto;padding:0}}
</style>
<div class="bar"><button onclick="window.print()">Print bill</button><a class="alt" href="?{ALT}">A4 invoice</a></div>
<div class="rc">
 <div class="ctr">${logo ? `<img class="logo" src="${esc(logo)}" alt="${esc(name)}">` : ''}<h1>${esc(name)}</h1>${c.tagline ? `<div class="m">${esc(c.tagline)}</div>` : ''}${c.address ? `<div class="m">${esc(c.address)}</div>` : ''}${c.phone ? `<div class="m">Ph: ${esc(c.phone)}</div>` : ''}${(d.supplier.gstin || c.gstin) ? `<div class="m">GSTIN: ${esc(d.supplier.gstin || c.gstin || '')}</div>` : ''}${c.fssai ? `<div class="m">FSSAI: ${esc(c.fssai)}</div>` : ''}</div>
 <div class="hr"></div>
 ${(c.gstin || d.supplier.gstin) ? '<div class="ctr"><b>TAX INVOICE</b></div>' : ''}
 ${line('Bill no', `<b>${esc(o.orderNumber)}</b>`)}${line('Date', esc(dateText(o.createdAt)))}${line('Payment', esc(pay))}
 ${line('Sold by', esc(d.supplier.name))}${d.shop?.name ? line('Store', esc(d.shop.name)) : ''}${line('Supply', esc(d.placeOfSupply))}
 <div class="hr"></div>
 <div><b>${esc(o.address.name)}</b> · ${esc(o.address.phone)}${d.buyerGstin ? `<div class="m">GSTIN: ${esc(d.buyerGstin)}</div>` : ''}<div class="m">${[o.address.line1, o.address.line2, o.address.city, o.address.pincode].filter(Boolean).map(esc).join(', ')}</div></div>
 <div class="hr"></div>
 ${items}
 <div class="hr"></div>
 ${o.discount > 0 ? line('Discount (already deducted)', `- ${inr(o.discount)}`) : ''}${taxLines}
 <div class="hr"></div>
 ${line('TOTAL', inr(o.total), true)}
 <div class="m" style="margin-top:3px">${esc(amountInWords(o.total))}</div>
 ${sumRows}
 <div class="hr"></div>
 <div class="ctr">${code128Svg(o.orderNumber, { height: 38, module: 1.3 })}<div style="margin-top:4px">${qrSvg(`${d.siteUrl}/orders/${String(o._id)}`, 70)}</div></div>
 <div class="signrow"><div class="m">For ${esc(name)}${sign ? `<br><img class="sig" src="${esc(sign)}" alt="Signature">` : ''}<br><b>${esc(c.signatoryName || 'Authorised Signatory')}</b></div>${seal ? `<img class="seal" src="${esc(seal)}" alt="Company seal">` : ''}</div>
 <div class="hr"></div>
 <div class="ctr m">${esc(c.declaration ? c.declaration : 'Goods once sold will not be taken back without the bill.')}</div>
 <div class="ctr" style="margin-top:6px"><b>Thank you! Visit again.</b></div>
 ${socialHtml(d.social, true)}
</div>`;
}

export function renderInvoiceHtml(d: InvoiceData, format: 'a4' | 'pos', altQuery: string, autoPrint: boolean): string {
  const body = (format === 'pos' ? pos(d) : a4(d)).replace('{ALT}', esc(altQuery));
  const title = `${d.order.orderNumber} - ${d.company.name || 'Bingoor'}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head><body>${body}${autoPrint ? '<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},400)})</script>' : ''}</body></html>`;
}
