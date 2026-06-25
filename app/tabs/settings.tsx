import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useAuthStore, useUIStore } from '@/store';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { verifySheetsConnection, VerifyResult } from '@/services/sheets.service';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsScreen() {
  const { user, signOut } = useAuthStore();
  const { language, theme, setLanguage, setTheme } = useUIStore();
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();

  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  useEffect(() => {
    handleVerifySheets(true);
  }, []);

  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      t('settings.confirm_logout') || "Confirm Logout",
      t('settings.logout_message') || "Are you sure you want to log out?",
      [
        { text: t('common.cancel') || "Cancel", style: 'cancel' },
        {
          text: t('settings.logout') || "Logout",
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/auth/login');
          },
        },
      ]
    );
  };

  const handleVerifySheets = async (silent = false) => {
    if (!silent) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setVerifying(true);
    try {
      const result = await verifySheetsConnection();
      setVerifyResult(result);
    } finally {
      setVerifying(false);
    }
  };

  const SectionHeader = ({ title }: { title: string }) => (
    <Text style={styles.sectionHeader}>{title.toUpperCase()}</Text>
  );

  const SettingRow = ({
    icon,
    label,
    subtitle,
    right,
    onPress,
    danger,
  }: {
    icon?: keyof typeof Ionicons.glyphMap;
    label: string;
    subtitle?: string;
    right?: React.ReactNode;
    onPress?: () => void;
    danger?: boolean;
  }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      {icon && (
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={20} color={danger ? COLORS.danger : '#64748B'} />
        </View>
      )}
      <View style={styles.rowInfo}>
        <Text style={[styles.rowLabel, { color: danger ? COLORS.danger : '#0F172A' }]}>
          {label}
        </Text>
        {subtitle && (
          <Text style={styles.rowSubtitle}>{subtitle}</Text>
        )}
      </View>
      {right ?? (onPress ? (
        <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
      ) : null)}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: '#F8F9FA' }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Profile Header (Business Profile & Dark Mode) */}
        <View style={[styles.card, styles.profileCard, SHADOW.sm]}>
          <View style={styles.profileContent}>
            <View style={[styles.avatar, { backgroundColor: COLORS.primary + '20' }]}>
              <Image 
                source={require('../../assets/logo.png')} 
                style={styles.avatarImage} 
              />
            </View>
            <View style={styles.profileText}>
              <Text style={styles.restaurantName}>Sabarish Foods</Text>
              <Text style={styles.userEmail}>{user?.email ?? 'sabarishfoods@gmail.com'}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>{user?.role === 'owner' ? 'Owner' : 'Staff'}</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.darkModeToggle}>
            <Switch
              value={isDark}
              onValueChange={async (v) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                await setTheme(v ? 'dark' : 'light');
              }}
              trackColor={{ false: '#E2E8F0', true: COLORS.primary }}
              thumbColor={'#FFF'}
            />
          </View>
        </View>

        {/* Preferences */}
        <SectionHeader title="Preferences" />
        
        {/* Language Selector */}
        <View style={[styles.card, styles.languageCard, SHADOW.sm]}>
          {(['en', 'ta'] as const).map((lang) => (
            <TouchableOpacity
              key={lang}
              style={[
                styles.languageSegment,
                language === lang && { backgroundColor: COLORS.primary },
              ]}
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                await setLanguage(lang);
              }}
            >
              <Text
                style={[
                  styles.languageText,
                  { color: language === lang ? '#FFF' : '#64748B' },
                ]}
              >
                {lang === 'ta' ? 'Tamil' : 'English'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.card, SHADOW.sm]}>
          <SettingRow
            icon="notifications-outline"
            label="Notifications"
            onPress={() => {}}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="cloud-upload-outline"
            label="Backup & Restore"
            onPress={() => {}}
          />
        </View>

        {/* Integration */}
        <SectionHeader title="Integration" />
        <View style={[styles.card, SHADOW.sm]}>
          <View style={styles.sheetsHeader}>
            <View style={styles.sheetsTitleRow}>
              <Ionicons name="document-text-outline" size={20} color="#64748B" style={{marginRight: 12}} />
              <View>
                <Text style={styles.rowLabel}>Google Sheets Connection</Text>
                {verifyResult && (
                  <View style={styles.statusRow}>
                    <View style={[styles.statusDot, { backgroundColor: verifyResult.connected ? COLORS.success : COLORS.danger }]} />
                    <Text style={[styles.statusText, { color: verifyResult.connected ? COLORS.successDark : COLORS.dangerDark }]}>
                      {verifyResult.connected ? 'Connected' : 'Not Connected'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <TouchableOpacity 
              style={[styles.connectBtn, { backgroundColor: verifyResult?.connected ? '#F1F5F9' : COLORS.primary }]}
              onPress={() => handleVerifySheets(false)}
              disabled={verifying}
            >
              {verifying ? (
                <ActivityIndicator size="small" color={verifyResult?.connected ? COLORS.primary : '#FFF'} />
              ) : (
                <Text style={[styles.connectBtnText, { color: verifyResult?.connected ? COLORS.primary : '#FFF' }]}>
                  {verifyResult?.connected ? 'Reconnect' : 'Connect'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Account */}
        <SectionHeader title="Account" />
        <View style={[styles.card, SHADOW.sm]}>
          <SettingRow
            icon="log-out-outline"
            label={t('settings.logout') || "Logout"}
            onPress={handleLogout}
            danger
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: {
    padding: 20,
    paddingBottom: 40,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  profileCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    marginBottom: 8,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 16,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  profileText: {
    flex: 1,
    gap: 4,
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  userEmail: {
    fontSize: 13,
    color: '#64748B',
  },
  roleBadge: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EA580C',
  },
  darkModeToggle: {
    paddingLeft: 12,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 4,
    paddingHorizontal: 8,
  },
  languageCard: {
    flexDirection: 'row',
    padding: 6,
    gap: 6,
  },
  languageSegment: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  languageText: {
    fontSize: 14,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
  },
  iconContainer: {
    width: 32,
    alignItems: 'flex-start',
  },
  rowInfo: { flex: 1 },
  rowLabel: { 
    fontSize: 15, 
    fontWeight: '600', 
  },
  rowSubtitle: { 
    fontSize: 13, 
    marginTop: 2,
    color: '#64748B',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 48,
  },
  sheetsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  sheetsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  connectBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 12,
  },
  connectBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
