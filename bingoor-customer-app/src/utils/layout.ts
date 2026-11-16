import { useWindowDimensions } from 'react-native';
import { gutter, ms, space } from '../theme';

export interface Grid {
  columns: number;
  cardWidth: number;
  gap: number;
  /** Content padding that keeps the grid aligned with the rest of the page. */
  padding: number;
}

/**
 * Works out how many cards fit the current screen instead of hard-coding two.
 *
 * Recomputes on rotation and on split-screen resize, so a phone shows 2, a
 * large phone in landscape 3-4 and a tablet 4-5 - all with the same card size.
 */
export function useGrid(minCardWidth = 112, gap = space.sm): Grid {
  const { width } = useWindowDimensions();
  const padding = gutter;
  const usable = width - padding * 2;

  const columns = Math.max(2, Math.floor((usable + gap) / (ms(minCardWidth) + gap)));
  const cardWidth = Math.floor((usable - gap * (columns - 1)) / columns);

  return { columns, cardWidth, gap, padding };
}

/**
 * Width for cards in a horizontal rail.
 *
 * The default deliberately leaves the next card half visible: a rail whose
 * last card ends flush with the screen edge reads as a finished list, and
 * people stop scrolling.
 */
export function useRailCardWidth(fraction = 0.33, max = 158): number {
  const { width } = useWindowDimensions();
  return Math.min(Math.round(width * fraction), ms(max));
}

/**
 * FlatList settings for product grids. Draw only what fits the first screen,
 * add rows in small batches while scrolling, and drop rows far off screen,
 * so long aisles stay smooth on low-end phones.
 */
export const productGridPerf = {
  initialNumToRender: 8,
  maxToRenderPerBatch: 8,
  windowSize: 7,
  removeClippedSubviews: true,
} as const;
