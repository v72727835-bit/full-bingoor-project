/** Code 128 (set B) barcode and QR code as inline SVG, so a bill needs no image files or network. */
import qrcode from 'qrcode-generator';

// Bar/space widths for symbol values 0-105, then the stop pattern.
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232',
];
const STOP = '2331112';
const START_B = 104;

/** The 0/1 module string for `text` (printable ASCII only; anything else is dropped). */
export function code128Modules(text: string): string {
  const clean = [...text].filter((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126).join('');
  const values = [...clean].map((c) => c.charCodeAt(0) - 32);
  let sum = START_B;
  values.forEach((v, i) => (sum += v * (i + 1)));
  const symbols = [START_B, ...values, sum % 103];
  let bits = '';
  for (const s of symbols) bits += widthsToBits(PATTERNS[s]);
  return bits + widthsToBits(STOP);
}

function widthsToBits(widths: string): string {
  let out = '';
  let bar = true;
  for (const w of widths) {
    out += (bar ? '1' : '0').repeat(Number(w));
    bar = !bar;
  }
  return out;
}

export function code128Svg(text: string, opts: { height?: number; module?: number; label?: boolean } = {}): string {
  const height = opts.height ?? 44;
  const m = opts.module ?? 1.6;
  const bits = '0'.repeat(10) + code128Modules(text) + '0'.repeat(10);
  const rects: string[] = [];
  for (let i = 0; i < bits.length; ) {
    if (bits[i] !== '1') {
      i++;
      continue;
    }
    let j = i;
    while (bits[j] === '1') j++;
    rects.push(`<rect x="${(i * m).toFixed(2)}" y="0" width="${((j - i) * m).toFixed(2)}" height="${height}"/>`);
    i = j;
  }
  const width = bits.length * m;
  const label = opts.label === false ? '' : `<text x="${(width / 2).toFixed(1)}" y="${height + 11}" text-anchor="middle" font-family="monospace" font-size="10">${esc(text)}</text>`;
  const total = height + (opts.label === false ? 0 : 14);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width.toFixed(1)} ${total}" width="${width.toFixed(0)}" height="${total}" shape-rendering="crispEdges" fill="#000">${rects.join('')}${label}</svg>`;
}

export function qrSvg(text: string, size = 84): string {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const rects: string[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) if (qr.isDark(r, c)) rects.push(`<rect x="${c}" y="${r}" width="1" height="1"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${n + 4} ${n + 4}" width="${size}" height="${size}" shape-rendering="crispEdges" fill="#000"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/>${rects.join('')}</svg>`;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}
