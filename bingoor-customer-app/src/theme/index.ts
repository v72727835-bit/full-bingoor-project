import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Appearance, Dimensions, PixelRatio, Platform, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { Palette, dark, light, sectionTint } from './palette';

export type { Palette };
export { sectionTint };

/* ============================================================================
 * Bingoor design system
 * One source of truth for colour, type, space, radius and elevation. Screens
 * never hard-code a hex or a magic number - which is what keeps thirty screens
 * looking like one product instead of thirty.
 * ========================================================================== */

/* ------------------------------------------------------------- responsive --
 * Sizes are authored against a 390pt-wide phone and scaled gently from there.
 * The clamp matters: without it a 320pt phone gets unreadable text and a
 * tablet gets comically large buttons.
 */
const BASE_WIDTH = 390;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const shortEdge = Math.min(SCREEN_W, SCREEN_H);

const rawScale = shortEdge / BASE_WIDTH;
/** Layout scale - clamped so tiny phones and tablets both stay sane. */
export const scale = Math.min(Math.max(rawScale, 0.88), 1.2);

/** Scale a spacing/size value and snap it to the device pixel grid. */
export const ms = (size: number, factor = 0.5): number =>
  PixelRatio.roundToNearestPixel(size + (size * scale - size) * factor);

export const screen = {
  width: SCREEN_W,
  height: SCREEN_H,
  isSmall: shortEdge < 360,
  isTablet: shortEdge >= 600,
};

/* -------------------------------------------------------------- spacing --- */
export const space = {
  xxs: ms(2),
  xs: ms(4),
  sm: ms(8),
  md: ms(12),
  lg: ms(16),
  xl: ms(20),
  xxl: ms(24),
  xxxl: ms(32),
  huge: ms(44),
} as const;

/** Horizontal page gutter - every screen uses this so edges line up. */
export const gutter = screen.isTablet ? ms(24) : ms(14);

/* --------------------------------------------------------------- radius --- */
export const radius = {
  xs: ms(6),
  sm: ms(10),
  md: ms(14),
  lg: ms(18),
  xl: ms(24),
  xxl: ms(30),
  pill: 999,
} as const;

/* ------------------------------------------------------------ elevation ---
 * Three steps only. More than that and a UI stops feeling deliberate.
 * Shadows barely read on a dark page, so dark mode leans on surfaceRaised
 * instead and keeps only a whisper of lift.
 */
function makeElevation(p: Palette): Record<'none' | 'sm' | 'md' | 'lg', ViewStyle> {
  const shadow = (y: number, blur: number, opacity: number, depth: number): ViewStyle =>
    Platform.OS === 'android'
      ? { elevation: p.mode === 'dark' ? Math.max(1, Math.round(depth * 0.6)) : depth }
      : {
          shadowColor: p.shadow,
          shadowOffset: { width: 0, height: y },
          shadowRadius: blur,
          shadowOpacity: p.mode === 'dark' ? opacity * 1.8 : opacity,
        };
  return {
    none: {},
    sm: shadow(1, 2, 0.05, 1),
    md: shadow(3, 10, 0.07, 2),
    lg: shadow(8, 20, 0.10, 6),
  };
}

/* ----------------------------------------------------------- typography ---
 * Line heights are generous and letter-spacing tightens as size grows, which
 * is the single biggest thing that makes type look typeset rather than default.
 */
type Variant = {
  fontSize: number;
  lineHeight: number;
  fontWeight: TextStyle['fontWeight'];
  letterSpacing?: number;
  textTransform?: TextStyle['textTransform'];
};

const v = (
  fontSize: number,
  lineHeight: number,
  fontWeight: TextStyle['fontWeight'],
  letterSpacing = 0,
): Variant => ({ fontSize: ms(fontSize), lineHeight: ms(lineHeight), fontWeight, letterSpacing });

export const type = {
  display: v(30, 38, '800', -0.7),
  h1: v(24, 31, '800', -0.5),
  h2: v(19, 26, '800', -0.3),
  h3: v(17, 24, '700', -0.2),
  h4: v(15, 21, '700', -0.1),
  bodyLg: v(16, 24, '400'),
  body: v(14.5, 22, '400'),
  bodySm: v(13, 19, '400'),
  label: v(13.5, 18, '600', 0.1),
  labelSm: v(12, 16, '600', 0.1),
  price: v(16, 21, '800', -0.2),
  priceSm: v(14.5, 19, '800', -0.1),
  caption: v(11.5, 16, '500', 0.15),
  overline: { ...v(10.5, 14, '700', 1.1), textTransform: 'uppercase' as const },
  button: v(15, 20, '700', 0.15),
} as const;

export type TypeVariant = keyof typeof type;

/* ---------------------------------------------------------------- font ---
 * Plus Jakarta Sans ships as one file per weight in android/app/src/main/assets
 * /fonts. Android picks a face by file name, not by fontWeight - so every
 * weight has to be translated to its own family, and fontWeight reset to
 * normal, or the OS draws a second fake bold on top of the real one.
 */
const FACE: Record<string, string> = {
  '100': 'Jakarta-Regular',
  '200': 'Jakarta-Regular',
  '300': 'Jakarta-Regular',
  '400': 'Jakarta-Regular',
  normal: 'Jakarta-Regular',
  '500': 'Jakarta-Medium',
  '600': 'Jakarta-SemiBold',
  '700': 'Jakarta-Bold',
  bold: 'Jakarta-Bold',
  '800': 'Jakarta-ExtraBold',
  '900': 'Jakarta-ExtraBold',
};

/** The font face for a weight, ready to spread into a text style. */
export function font(weight: TextStyle['fontWeight'] = '400'): TextStyle {
  return { fontFamily: FACE[String(weight)] ?? FACE['400'], fontWeight: 'normal' };
}

/* -------------------------------------------------------------- effects ---
 * Native CSS-style gradients and shadows (React Native 0.76+, new arch). They
 * cost nothing extra to install and render on the GPU like any other view.
 */
export const gradient = {
  /** Vertical, so the bottom edge is a single colour a sticky bar can match. */
  down: (from: string, to: string) => `linear-gradient(180deg, ${from} 0%, ${to} 100%)`,
  diagonal: (from: string, to: string) => `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
  /** A soft pool of light, used for the glow in the header's top corner. */
  glow: (color: string, at = '85% 0%') => `radial-gradient(circle at ${at}, ${color} 0%, transparent 60%)`,
};

/** Coloured light under a raised element - the thing that makes pink "glow". */
export const glowShadow = (color: string, y = 6, blur = 18) => `0px ${y}px ${blur}px 0px ${color}`;

/**
 * Caps how far the OS font-size setting can stretch our text. Users who need
 * larger text still get it; layouts just never blow apart at 200%.
 */
export const MAX_FONT_SCALE = 1.28;

/**
 * React Native 0.87 dropped StyleSheet.absoluteFillObject, so we keep our own.
 * Spreadable into a StyleSheet entry, unlike StyleSheet.absoluteFill.
 */
export const fillParent = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

/** Minimum tappable square. Anything interactive must reach this. */
export const HIT_SIZE = 44;
export const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 };

export const currency = (value: number): string => {
  const rounded = Math.round(value * 100) / 100;
  const whole = Number.isInteger(rounded);
  return `₹${rounded.toLocaleString('en-IN', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
};

/* ---------------------------------------------------------------- theme --- */

export type ThemeMode = 'light' | 'dark';
export type ThemePreference = ThemeMode | 'system';

export interface Theme {
  /** Colours for the active mode. Short name because it is read constantly. */
  c: Palette;
  mode: ThemeMode;
  elevation: Record<'none' | 'sm' | 'md' | 'lg', ViewStyle>;
  /** What the user picked; 'system' follows the phone. */
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  /** Adapts a backend category pastel to the current mode. */
  tint: (hex?: string) => string;
}

const ThemeContext = createContext<Theme | undefined>(undefined);

export function ThemeProvider({
  children,
  initialPreference = 'system',
}: {
  children: React.ReactNode;
  initialPreference?: ThemePreference;
}) {
  const [preference, setPreference] = useState<ThemePreference>(initialPreference);
  const [systemMode, setSystemMode] = useState<ThemeMode>(Appearance.getColorScheme() === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) =>
      setSystemMode(colorScheme === 'dark' ? 'dark' : 'light'),
    );
    return () => sub.remove();
  }, []);

  const mode: ThemeMode = preference === 'system' ? systemMode : preference;
  // Set before children render so module-level `colors` and `themed()` styles
  // resolve against the mode this pass is painting.
  currentMode = mode;

  const value = useMemo<Theme>(() => {
    const c = mode === 'dark' ? dark : light;
    return {
      c,
      mode,
      elevation: makeElevation(c),
      preference,
      setPreference,
      tint: (hex?: string) => sectionTint(hex, c),
    };
  }, [mode, preference]);

  return React.createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

/* ---------------------------------------------------------- live colour ---
 * Which palette is showing right now. The provider writes it during render,
 * before any child renders, so the getters below always answer for the mode
 * the tree is about to paint in.
 */
let currentMode: ThemeMode = 'light';

/** Builds an object whose every key reads from the active palette. */
function liveView<T extends object>(variants: Record<ThemeMode, T>): T {
  const view = {} as T;
  for (const key of Object.keys(variants.light) as (keyof T)[]) {
    Object.defineProperty(view, key, { get: () => variants[currentMode][key], enumerable: true });
  }
  return view;
}

/**
 * The active palette, readable from anywhere - including module scope and
 * outside a component.
 *
 * `StyleSheet.create` resolves its values once at import time, which is exactly
 * what breaks when colour can change at runtime. Reading `colors.ink` during
 * render is fine because it is a getter; putting it inside a module-level
 * StyleSheet is not, and that is what `themed()` below is for.
 */
export const colors: Palette = liveView({ light, dark });

/** Elevation for the active palette, same live trick. */
export const elevation = liveView({ light: makeElevation(light), dark: makeElevation(dark) });

type NamedStyles = Record<string, ViewStyle | TextStyle | Record<string, unknown>>;

/**
 * Module-level replacement for `StyleSheet.create` when the styles use colour.
 *
 * Both variants are compiled once at import, and the returned object hands back
 * whichever one matches the mode currently being rendered. That keeps the
 * familiar `styles.row` call site - and the StyleSheet registration that makes
 * it cheap - while still flipping the whole app to dark instantly.
 */
export function themed<T extends NamedStyles>(factory: (t: { c: Palette; elevation: Record<'none' | 'sm' | 'md' | 'lg', ViewStyle> }) => T): T {
  const build = (p: Palette) => StyleSheet.create(factory({ c: p, elevation: makeElevation(p) })) as T;
  return liveView({ light: build(light), dark: build(dark) });
}

/**
 * Builds a StyleSheet from the current theme and caches it per (factory, mode).
 *
 * StyleSheet.create resolves once at module load, which is exactly what breaks
 * when colours can change at runtime - so styles that depend on colour are
 * authored as a function of the theme and rebuilt only when the mode flips,
 * not on every render.
 */
export function useStyles<T extends NamedStyles>(factory: (t: Theme) => T): T {
  const theme = useTheme();
  const cache = useRef<Map<ThemeMode, T>>(new Map());
  const hit = cache.current.get(theme.mode);
  if (hit) return hit;
  const built = StyleSheet.create(factory(theme)) as T;
  cache.current.set(theme.mode, built);
  return built;
}

/** Convenience for the very common "I only need the colours" case. */
export function useColors(): Palette {
  return useTheme().c;
}

