import React from 'react';
import { Tabs } from 'expo-router';
import { Platform, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { COLORS, FONTS, RADIUS, SHADOW } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { SyncToast } from '@/components/ui/SyncToast';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface Tab {
  name: string;
  key: 'home' | 'expenses' | 'kadan' | 'inventory' | 'reports' | 'settings';
  icon: IoniconsName;
  iconActive: IoniconsName;
  titleKey: string;
}

const TAB_DEFS: Tab[] = [
  { name: 'index', key: 'home', icon: 'home-outline', iconActive: 'home-outline', titleKey: 'nav.home' },
  { name: 'expenses', key: 'expenses', icon: 'receipt-outline', iconActive: 'receipt-outline', titleKey: 'nav.expenses' },
  { name: 'kadan', key: 'kadan', icon: 'people-outline', iconActive: 'people-outline', titleKey: 'nav.kadan' },
  { name: 'inventory', key: 'inventory', icon: 'cube-outline', iconActive: 'cube-outline', titleKey: 'nav.inventory' },
  { name: 'reports', key: 'reports', icon: 'bar-chart-outline', iconActive: 'bar-chart-outline', titleKey: 'nav.reports' },
  { name: 'settings', key: 'settings', icon: 'settings-outline', iconActive: 'settings-outline', titleKey: 'nav.settings' },
];

export default function TabLayout() {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopColor: '#F1F5F9',
            borderTopWidth: 1,
            height: Platform.OS === 'ios' ? 85 : 65,
            paddingBottom: Platform.OS === 'ios' ? 24 : 8,
            paddingTop: 8,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarActiveTintColor: '#F97316',
          tabBarInactiveTintColor: '#94A3B8',
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginTop: 4,
          },
        }}
      >
        {TAB_DEFS.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: t(tab.titleKey),
              tabBarIcon: ({ focused, color }) => (
                <Ionicons
                  name={tab.icon}
                  size={24}
                  color={color}
                />
              ),
            }}
          />
        ))}
      </Tabs>
      <SyncToast />
    </>
  );
}
