import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore, useUIStore, useSyncStore, initUIPreferences } from '@/store';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { useTheme } from '@/hooks/useTheme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { initialize, isLoading } = useAuthStore();
  const language = useUIStore((s) => s.language); // Triggers re-render on lang change
  const { colors, isDark } = useTheme();
  useNetworkStatus(); // Starts network listener

  useEffect(() => {
    const boot = async () => {
      await initUIPreferences();
      await initialize();
      // Initialize Google Sheets sync (queue, network monitor)
      useSyncStore.getState().initialize();
      await SplashScreen.hideAsync();
    };
    boot();
  }, []);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="tabs" />
        <Stack.Screen name="kadan" options={{ animation: 'slide_from_right' }} />
      </Stack>
      <OfflineBanner />
    </>
  );
}
