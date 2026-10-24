export const colors = {
  primary: '#F97316',
  primaryDark: '#EA580C',
  primarySoft: '#FFF1E6',
  background: '#F4F6FB',
  card: '#FFFFFF',
  text: '#0B1220',
  muted: '#6B7A90',
  border: '#E6EBF2',
  danger: '#E11D48',
  dangerSoft: '#FFE4E9',
  success: '#059669',
  successSoft: '#D1FAE5',
  star: '#F59E0B',
};

/** Bright accents so each section of the app has its own colour. */
export const accents = {
  orange: { base: '#F97316', soft: '#FFEAD5', ink: '#9A3412' },
  blue: { base: '#3B82F6', soft: '#DBEAFE', ink: '#1E40AF' },
  violet: { base: '#8B5CF6', soft: '#EDE9FE', ink: '#5B21B6' },
  emerald: { base: '#10B981', soft: '#D1FAE5', ink: '#065F46' },
  amber: { base: '#F59E0B', soft: '#FEF3C7', ink: '#92400E' },
  rose: { base: '#F43F5E', soft: '#FFE4E9', ink: '#9F1239' },
  cyan: { base: '#06B6D4', soft: '#CFFAFE', ink: '#155E75' },
};

export const radius = { sm: 10, md: 14, lg: 18, xl: 26, pill: 999 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const shadow = {
  shadowColor: '#0B1220',
  shadowOpacity: 0.08,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
} as const;

export const softShadow = {
  shadowColor: '#0B1220',
  shadowOpacity: 0.05,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
} as const;
