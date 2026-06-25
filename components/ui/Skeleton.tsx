import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { RADIUS } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: object;
}

function SkeletonItem({ width = '100%', height = 16, borderRadius = RADIUS.sm, style }: SkeletonProps) {
  const { isDark } = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width: width as number, height, borderRadius },
        { backgroundColor: isDark ? '#302E2B' : '#E8E5DF' },
        { opacity },
        style,
      ]}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {[1, 2, 3].map((i) => (
          <SkeletonItem key={i} width="31%" height={90} borderRadius={16} />
        ))}
      </View>
      <View style={styles.row}>
        {[1, 2].map((i) => (
          <SkeletonItem key={i} width="48%" height={120} borderRadius={20} />
        ))}
      </View>
      <SkeletonItem height={140} borderRadius={20} style={{ marginTop: 8 }} />
      <View style={styles.row}>
        {[1, 2].map((i) => (
          <SkeletonItem key={i} width="48%" height={100} borderRadius={20} />
        ))}
      </View>
    </View>
  );
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.listItem}>
          <SkeletonItem width={44} height={44} borderRadius={22} />
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonItem height={14} width="60%" />
            <SkeletonItem height={12} width="40%" />
          </View>
          <SkeletonItem width={64} height={14} />
        </View>
      ))}
    </View>
  );
}

export function CardSkeleton() {
  return <SkeletonItem height={120} borderRadius={20} />;
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
