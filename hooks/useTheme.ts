import { useUIStore } from '@/store';
import { COLORS } from '@/constants/theme';

export interface ThemeColors {
  background: string;
  surface: string;
  surface2: string;
  border: string;
  divider: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  card: string;
}

export function useTheme() {
  const theme = useUIStore((s) => s.theme);
  const isDark = theme === 'dark';

  const colors: ThemeColors = isDark
    ? {
        background: COLORS.dark.background,
        surface: COLORS.dark.surface,
        surface2: COLORS.dark.surface2,
        border: COLORS.dark.border,
        divider: COLORS.dark.divider,
        text: COLORS.dark.text,
        textSecondary: COLORS.dark.textSecondary,
        textTertiary: '#6B6560',
        card: COLORS.dark.surface,
      }
    : {
        background: COLORS.background,
        surface: COLORS.surface,
        surface2: '#F4F2EE',
        border: COLORS.border,
        divider: COLORS.divider,
        text: COLORS.text,
        textSecondary: COLORS.textSecondary,
        textTertiary: COLORS.textTertiary,
        card: COLORS.surface,
      };

  return { theme, isDark, colors };
}
