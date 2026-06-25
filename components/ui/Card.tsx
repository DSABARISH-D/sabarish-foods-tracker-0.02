import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { RADIUS, SHADOW } from '@/constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  glass?: boolean;
  shadow?: 'sm' | 'md' | 'lg' | 'none';
  padding?: number;
}

export function Card({ children, style, glass = false, shadow = 'md', padding = 16 }: CardProps) {
  const { colors, isDark } = useTheme();

  const shadowStyle = shadow === 'none' ? {} : SHADOW[shadow];

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: glass ? (isDark ? 'rgba(30,28,26,0.85)' : 'rgba(255,255,255,0.85)') : colors.surface },
        { padding },
        shadowStyle,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
  },
});
