import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '@/constants/theme';
import { KadanStatus } from '@/types';

interface BadgeProps {
  label: string;
  variant?: 'success' | 'danger' | 'warning' | 'info' | 'neutral';
  status?: KadanStatus;
  size?: 'sm' | 'md';
}

const STATUS_MAP: Record<KadanStatus, BadgeProps['variant']> = {
  pending: 'warning',
  paid: 'success',
  overdue: 'danger',
};

const VARIANT_COLORS = {
  success: { bg: COLORS.successLight, text: COLORS.successDark },
  danger: { bg: COLORS.dangerLight, text: COLORS.dangerDark },
  warning: { bg: COLORS.warningLight, text: COLORS.warningDark },
  info: { bg: COLORS.infoLight, text: COLORS.infoDark },
  neutral: { bg: '#F0EDE8', text: '#6B6560' },
};

export function Badge({ label, variant, status, size = 'md' }: BadgeProps) {
  const resolvedVariant = status ? STATUS_MAP[status] ?? 'neutral' : variant ?? 'neutral';
  const { bg, text } = VARIANT_COLORS[resolvedVariant];

  return (
    <View style={[styles.badge, { backgroundColor: bg }, size === 'sm' && styles.badgeSm]}>
      <Text style={[styles.text, { color: text }, size === 'sm' && styles.textSm]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingHorizontal: SPACING.xs + 2,
    paddingVertical: 2,
  },
  text: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.semiBold,
    letterSpacing: 0.3,
  },
  textSm: {
    fontSize: 10,
  },
});
