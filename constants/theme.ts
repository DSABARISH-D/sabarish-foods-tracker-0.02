// ====================================
// SABARISH FOODS — Design System / Theme
// ====================================

export const COLORS = {
  // Brand
  primary: '#FF7A00',       // Original Orange
  primaryLight: '#FFA733',
  primaryDark: '#CC6200',
  secondary: '#60A5FA',     // Original Blue
  secondaryLight: '#93C5FD',
  accent: '#A78BFA',        // Original Purple

  // Backgrounds (Light)
  background: '#FAF9F6',    // Original off-white background
  surface: '#FFFFFF',
  border: '#E5E5E5',
  divider: '#F3F4F6',

  // Backgrounds (Dark)
  dark: {
    background: '#141210',
    surface: '#1E1C1A',
    surface2: '#252320',
    border: '#302E2B',
    divider: '#2A2825',
    text: '#F5F3F0',
    textSecondary: '#9E9A94',
  },

  // Status
  success: '#22C55E',
  successLight: '#DCFCE7',
  successDark: '#16A34A',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  dangerDark: '#DC2626',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  warningDark: '#D97706',
  info: '#3B82F6',
  infoLight: '#DBEAFE',
  infoDark: '#2563EB',

  // Text
  text: '#1A1816',
  textSecondary: '#6B6560',
  textTertiary: '#9E9A94',
  textInverse: '#FFFFFF',

  // Gradients (start → end)
  gradients: {
    primary:   ['#FF6B35', '#FF8C5A'],
    secondary: ['#2D6A4F', '#40916C'],
    gold:      ['#F4A031', '#F6BF5A'],
    blue:      ['#3B82F6', '#60A5FA'],
    purple:    ['#8B5CF6', '#A78BFA'],
    green:     ['#22C55E', '#4ADE80'],
    red:       ['#EF4444', '#F87171'],
    orange:    ['#F97316', '#FB923C'],
    teal:      ['#14B8A6', '#2DD4BF'],
    dark:      ['#1E1C1A', '#252320'],
  },

  // Stat card colors
  statCards: {
    petty:    { start: '#F4A031', end: '#F6BF5A' },
    hand:     { start: '#22C55E', end: '#4ADE80' },
    bank:     { start: '#3B82F6', end: '#60A5FA' },
    sales:    { start: '#FF6B35', end: '#FF8C5A' },
    expenses: { start: '#8B5CF6', end: '#A78BFA' },
    profit:   { start: '#2D6A4F', end: '#40916C' },
  },
};

export const FONTS = {
  family: {
    regular: 'System',
    medium: 'System',
    semiBold: 'System',
    bold: 'System',
  },
  size: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 19,
    '2xl': 22,
    '3xl': 26,
    '4xl': 32,
    '5xl': 40,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semiBold: '600' as const,
    bold: '700' as const,
    extraBold: '800' as const,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
};

export const RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
};

export const SHADOW = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  colored: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  }),
};

export const ANIMATION = {
  fast: 200,
  normal: 300,
  slow: 500,
  spring: {
    damping: 15,
    stiffness: 200,
    mass: 0.8,
  },
};
