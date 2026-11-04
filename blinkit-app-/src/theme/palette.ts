/**
 * Two palettes, identical key for key, so a component never asks which mode it
 * is in - it just reads `c.inkMuted` and gets something readable either way.
 *
 * Every foreground/background pair below was measured: body text clears
 * WCAG AA (4.5:1) and UI shapes clear 3:1. `inkFaint` is the one deliberate
 * 3.6:1 - it is for placeholders and disabled states, never for prose.
 */
export interface Palette {
  mode: 'light' | 'dark';

  brand: string;
  brandPressed: string;
  brandDeep: string;
  /** Brand colour safe to use as TEXT on a page background. */
  brandText: string;
  brandSurface: string;
  brandSurfaceStrong: string;
  brandBorder: string;
  onBrand: string;

  accent: string;
  accentSurface: string;
  gold: string;
  /** The blue used for "5% OFF on MRP" style savings lines. */
  save: string;
  saveSurface: string;

  ink: string;
  inkBody: string;
  inkMuted: string;
  inkFaint: string;

  surface: string;
  surfaceSunken: string;
  surfaceRaised: string;
  /** Backdrop for a merchandised strip that should stand off the page. */
  surfaceTint: string;
  overlay: string;
  skeleton: string;

  border: string;
  borderStrong: string;

  success: string;
  successSurface: string;
  successBorder: string;
  warning: string;
  warningSurface: string;
  danger: string;
  dangerSurface: string;
  info: string;
  infoSurface: string;

  veg: string;
  nonveg: string;

  /** Header band behind the address and search bar. */
  headerFrom: string;
  headerTo: string;
  /** Soft light that sits in the top corner of the header gradient. */
  headerGlow: string;
  /** The deep band behind "Deals of the day". */
  dealsFrom: string;
  dealsTo: string;
  /** Highlighter-pen swipe behind a deal price, and the ink that sits on it. */
  priceMark: string;
  /** Icons and the active-tab line on the header band (navy on the yellow header). */
  headerAccent: string;
  onPriceMark: string;
  /** Colour of the soft light under primary buttons. */
  glow: string;
  /** Text and icons that sit on the header band. */
  onHeader: string;
  onHeaderMuted: string;

  shadow: string;

  /* Kept so older screens keep compiling while they migrate. */
  brandStrong: string;
  brandInk: string;
  brandLight: string;
}

export const light: Palette = {
  mode: 'light',

  brand: '#0B2E6B',
  brandPressed: '#082459',
  brandDeep: '#061B45',
  brandText: '#0B2E6B',
  brandSurface: '#EAF0FA',
  brandSurfaceStrong: '#D5E0F4',
  brandBorder: '#A9BCE3',
  onBrand: '#FFFFFF',

  accent: '#A15C00',
  accentSurface: '#FFF6D6',
  gold: '#F5B800',
  save: '#1558B0',
  saveSurface: '#E8F1FB',

  ink: '#111A14',
  inkBody: '#334038',
  inkMuted: '#5A675F',
  inkFaint: '#848F88',

  surface: '#FFFFFF',
  surfaceSunken: '#F4F6F5',
  surfaceRaised: '#FFFFFF',
  surfaceTint: '#FFF8DB',
  overlay: 'rgba(17, 26, 20, 0.55)',
  skeleton: '#E6ECE8',

  border: '#E4E9E6',
  borderStrong: '#CAD5CE',

  success: '#0B7A4B',
  successSurface: '#E6F4EC',
  successBorder: '#9FD6BA',
  warning: '#8A5A00',
  warningSurface: '#FFF4DE',
  danger: '#C02626',
  dangerSurface: '#FDECEC',
  info: '#1257A6',
  infoSurface: '#E8F1FB',

  veg: '#1E8E3E',
  nonveg: '#A3341F',

  headerFrom: '#FFD21F',
  headerTo: '#FFD21F',
  onHeader: '#0B2E6B',
  onHeaderMuted: 'rgba(11,46,107,0.80)',

  shadow: '#0B1A3A',
  headerGlow: 'rgba(255, 255, 255, 0)',
  dealsFrom: '#0B2E6B',
  dealsTo: '#0B2E6B',
  priceMark: '#FFD23F',
  headerAccent: '#0B2E6B',
  onPriceMark: '#15101A',
  glow: 'rgba(11, 46, 107, 0.10)',

  brandStrong: '#061B45',
  brandInk: '#0B2E6B',
  brandLight: '#1F4FA3',
};

export const dark: Palette = {
  mode: 'dark',

  brand: '#FFD21F',
  brandPressed: '#FFE066',
  brandDeep: '#FFE680',
  brandText: '#FFD95A',
  brandSurface: '#1E2433',
  brandSurfaceStrong: '#262E42',
  brandBorder: '#3C4A6B',
  onBrand: '#0B1A33',

  accent: '#FFC93C',
  accentSurface: '#2E2710',
  gold: '#FFC93C',
  save: '#86BBFF',
  saveSurface: '#182739',

  ink: '#F1F7F3',
  inkBody: '#D0DBD4',
  inkMuted: '#9CA9A1',
  inkFaint: '#7F8C84',

  surface: '#111723',
  surfaceSunken: '#0A0F18',
  surfaceRaised: '#192131',
  surfaceTint: '#171F2E',
  overlay: 'rgba(0, 0, 0, 0.68)',
  skeleton: '#1F2737',

  border: '#283247',
  borderStrong: '#3B4760',

  success: '#52D18E',
  successSurface: '#16301F',
  successBorder: '#2F6B48',
  warning: '#FFC247',
  warningSurface: '#332705',
  danger: '#FF8A8A',
  dangerSurface: '#3A1A1A',
  info: '#7EB6FF',
  infoSurface: '#182739',

  veg: '#52D18E',
  nonveg: '#FF8A7A',

  headerFrom: '#0B1A33',
  headerTo: '#0B1A33',
  onHeader: '#FFFFFF',
  onHeaderMuted: 'rgba(255,255,255,0.80)',

  shadow: '#000000',
  headerGlow: 'rgba(255, 255, 255, 0)',
  dealsFrom: '#0B1A33',
  dealsTo: '#0B1A33',
  priceMark: '#FFD23F',
  headerAccent: '#FFD23F',
  onPriceMark: '#1A1400',
  glow: 'rgba(0, 0, 0, 0.30)',

  brandStrong: '#FFE066',
  brandInk: '#FFD95A',
  brandLight: '#FFD21F',
};

/**
 * Backend sends one pastel per category, chosen for a white page. Dropped
 * straight onto a dark page those pastels glow, so in dark mode we keep the
 * hue and borrow the page's own darkness for the rest.
 */
export function sectionTint(hex: string | undefined, p: Palette): string {
  if (!hex) return p.surfaceTint;
  if (p.mode === 'light') return hex;
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim());
  if (!m) return p.surfaceTint;
  const [r, g, b] = [1, 2, 3].map((i) => parseInt(m[i], 16));
  // A fifth of the pastel over the card surface the tiles sit on. Enough for
  // each aisle to read as its own colour, not enough to lift the background
  // into the range where the label stops clearing AA.
  const base = [0x12, 0x1a, 0x15];
  const mix = [r, g, b].map((v, i) => Math.round(base[i] + (v - base[i]) * 0.22));
  return `#${mix.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
