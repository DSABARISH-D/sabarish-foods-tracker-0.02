import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useNetworkStore } from '@/hooks/useNetworkStatus';
import { COLORS, FONTS } from '@/constants/theme';
import { useTranslation } from '@/hooks/useTranslation';

export function OfflineBanner() {
  const isOffline = useNetworkStore((s) => s.isOffline);
  const { t } = useTranslation();
  const slideY = useRef(new Animated.Value(-40)).current;

  useEffect(() => {
    Animated.spring(slideY, {
      toValue: isOffline ? 0 : -40,
      useNativeDriver: true,
      damping: 15,
      stiffness: 150,
    }).start();
  }, [isOffline, slideY]);

  return (
    <Animated.View
      style={[styles.banner, { transform: [{ translateY: slideY }] }]}
      pointerEvents="none"
    >
      <Text style={styles.icon}>📡</Text>
      <Text style={styles.text}>{t('common.offline')}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1A1816',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
    zIndex: 9999,
  },
  icon: {
    fontSize: 16,
  },
  text: {
    color: '#FFF',
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
  },
});
