import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSyncStore } from '@/store';
import { COLORS, FONTS, RADIUS, SHADOW } from '@/constants/theme';

export function SyncToast() {
  const { syncStatus, syncError, resetSync } = useSyncStore();
  const translateY = useRef(new Animated.Value(80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const isVisible = syncStatus === 'success' || syncStatus === 'error' || syncStatus === 'syncing';

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 15, stiffness: 180 }),
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();

      if (syncStatus === 'success' || syncStatus === 'error') {
        const timer = setTimeout(() => {
          Animated.parallel([
            Animated.timing(translateY, { toValue: 80, duration: 300, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          ]).start(() => resetSync());
        }, 2500);
        return () => clearTimeout(timer);
      }
    }
  }, [syncStatus]);

  if (!isVisible && syncStatus === 'idle') return null;

  const config = {
    syncing: { emoji: '⏳', text: 'Syncing to Google Sheets...', bg: '#1A1816' },
    success: { emoji: '✅', text: 'Synced to Google Sheets', bg: COLORS.success },
    error: { emoji: '❌', text: syncError ?? 'Sheets sync failed', bg: COLORS.danger },
    idle: { emoji: '', text: '', bg: '#000' },
  }[syncStatus];

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        { backgroundColor: config.bg, transform: [{ translateY }], opacity },
        SHADOW.lg,
      ]}
    >
      <Text style={styles.emoji}>{config.emoji}</Text>
      <Text style={styles.text} numberOfLines={2}>{config.text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    borderRadius: RADIUS.lg,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
    zIndex: 9999,
  },
  emoji: { fontSize: 18 },
  text: {
    flex: 1,
    color: '#FFF',
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
  },
});
