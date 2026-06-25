import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from '@/constants/theme';
import { formatCurrency, formatNumber } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: number;
  emoji: string;
  gradientColors: [string, string];
  size?: 'sm' | 'md' | 'lg';
  isCurrency?: boolean;
  isNegative?: boolean;
  delay?: number;
}

export function StatCard({
  title,
  value,
  emoji,
  gradientColors,
  size = 'md',
  isCurrency = true,
  isNegative,
  delay = 0,
}: StatCardProps) {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const displayValue = useRef(new Animated.Value(0)).current;
  const [currentVal, setCurrentVal] = React.useState(0);

  useEffect(() => {
    const listenerId = displayValue.addListener(({ value }) => {
      setCurrentVal(value);
    });

    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        delay,
        damping: 14,
        stiffness: 180,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(displayValue, {
        toValue: value,
        duration: 800,
        delay: delay + 100,
        useNativeDriver: false,
      }),
    ]).start();

    return () => {
      displayValue.removeListener(listenerId);
    };
  }, [value, delay]);

  const heights = { sm: 90, md: 120, lg: 150 };
  const valueFontSizes = { sm: FONTS.size['2xl'], md: FONTS.size['3xl'], lg: FONTS.size['4xl'] };

  return (
    <Animated.View
      style={[
        { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
        SHADOW.colored(gradientColors[0]),
      ]}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, { minHeight: heights[size] }]}
      >
        {/* Decorative circles */}
        <View style={[styles.circle, styles.circle1]} />
        <View style={[styles.circle, styles.circle2]} />

        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={styles.title}>{title}</Text>
        <Animated.Text
          style={[
            styles.value,
            { fontSize: valueFontSizes[size] },
            isNegative === true && { color: '#FFE0E0' },
          ]}
        >
          {isCurrency ? formatCurrency(currentVal) : formatNumber(currentVal)}
        </Animated.Text>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  circle: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 9999,
  },
  circle1: {
    width: 90,
    height: 90,
    top: -20,
    right: -20,
  },
  circle2: {
    width: 60,
    height: 60,
    top: 30,
    right: 40,
  },
  emoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  title: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
    marginBottom: 4,
  },
  value: {
    color: '#FFFFFF',
    fontWeight: FONTS.weight.extraBold,
    letterSpacing: -0.5,
  },
});
