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
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore, useUIStore, useSyncStore } from '@/store';
import { COLORS, SHADOW } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { changeUserMpin } from '@/services/staff.service';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsScreen() {
  const { user, activeStaff, activePermissions, switchStaff, logoutStaff, signOut } = useAuthStore();
  const { language, theme, setLanguage, setTheme } = useUIStore();
  const {
    connectionStatus,
    lastSyncedAt,
    pendingCount,
    syncError,
    initialize: initSync,
    checkGoogleSheetsConnection,
    retryPending,
    clearPending,
  } = useSyncStore();
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();

  const [verifying, setVerifying] = useState(false);

  // Pinpad modal state
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinText, setPinText] = useState('');
  const [pinError, setPinError] = useState('');

  // Change MPIN state
  const [changeMpinModalVisible, setChangeMpinModalVisible] = useState(false);
  const [currentMpin, setCurrentMpin] = useState('');
  const [newMpin, setNewMpin] = useState('');
  const [confirmNewMpin, setConfirmNewMpin] = useState('');
  const [changingMpin, setChangingMpin] = useState(false);

  const handleChangeMpin = async () => {
    const targetUser = activeStaff || user;
    if (!targetUser) return;

    if (!currentMpin || !newMpin || !confirmNewMpin) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    if (currentMpin.length !== 4 || newMpin.length !== 4 || confirmNewMpin.length !== 4) {
      Alert.alert('Error', 'MPIN must be exactly 4 digits.');
      return;
    }

    if (newMpin !== confirmNewMpin) {
      Alert.alert('Error', 'New MPINs do not match.');
      return;
    }

    if (currentMpin === newMpin) {
      Alert.alert('Error', 'New MPIN cannot be the same as the current MPIN.');
      return;
    }

    setChangingMpin(true);
    try {
      await changeUserMpin(targetUser.id, currentMpin, newMpin);
      
      Alert.alert('Success', 'MPIN changed successfully.');
      setChangeMpinModalVisible(false);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to change MPIN.');
    } finally {
      setChangingMpin(false);
    }
  };

  useEffect(() => {
    initSync();
    handleVerifySheets(true);
  }, []);

  const handleLogout = () => {
    
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
    if (!silent) 
    setVerifying(true);
    try {
      await checkGoogleSheetsConnection();
    } finally {
      setVerifying(false);
    }
  };

  const handleRetrySync = async () => {
    
    await retryPending();
  };

  // Format last sync time for display
  const formatLastSync = (isoStr: string | null): string => {
    if (!isoStr) return 'Never';
    const date = new Date(isoStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  // Connection status emoji and color
  const getStatusIndicator = (): { emoji: string; color: string; label: string } => {
    switch (connectionStatus) {
      case 'connected': return { emoji: '🟢', color: '#22C55E', label: 'Connected' };
      case 'syncing':   return { emoji: '🔄', color: '#F59E0B', label: 'Syncing...' };
      case 'failed':    return { emoji: '🔴', color: '#EF4444', label: 'Failed' };
      case 'offline':   return { emoji: '📡', color: '#94A3B8', label: 'Offline' };
      default:          return { emoji: '⚪', color: '#94A3B8', label: 'Not Configured' };
    }
  };

  const handlePinPress = async (digit: string) => {
    
    setPinError('');
    if (pinText.length >= 4) return;
    
    const newPin = pinText + digit;
    setPinText(newPin);

    if (newPin.length === 4) {
      // Trigger verify
      const success = await switchStaff(newPin);
      if (success) {
        
        setPinModalVisible(false);
        setPinText('');
        Alert.alert('Success', 'User profile updated');
      } else {
        
        setPinError('Invalid MPIN');
        setPinText('');
      }
    }
  };

  const handlePinBackspace = () => {
    
    setPinText(pinText.slice(0, -1));
    setPinError('');
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
          <Ionicons name={icon} size={20} color={danger ? '#EF4444' : '#64748B'} />
        </View>
      )}
      <View style={styles.rowInfo}>
        <Text style={[styles.rowLabel, { color: danger ? '#EF4444' : '#0F172A' }]}>
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
        {/* Profile Header (Business Profile & Active User) */}
        <View style={[styles.card, styles.profileCard, SHADOW.sm]}>
          <View style={styles.profileContent}>
            <View style={[styles.avatar, { backgroundColor: '#FFEDD5' }]}>
              <Image 
                source={require('../../assets/logo.jpg')} 
                style={styles.avatarImage} 
              />
            </View>
            <View style={styles.profileText}>
              <Text style={styles.restaurantName}>
                {activeStaff ? activeStaff.full_name : 'Sabarish Foods'}
              </Text>
              <Text style={styles.userEmail}>
                {activeStaff ? `Phone: ${activeStaff.phone_number}` : (user?.email ?? 'sabarishfoods@gmail.com')}
              </Text>
              <View style={[styles.roleBadge, activeStaff && styles.roleBadgeStaff]}>
                <Text style={[styles.roleText, activeStaff && styles.roleTextStaff]}>
                  {activeStaff ? (activeStaff.role.charAt(0).toUpperCase() + activeStaff.role.slice(1)) : 'Owner'}
                </Text>
              </View>
            </View>
          </View>
          
          <View style={styles.darkModeToggle}>
            <Switch
              value={isDark}
              onValueChange={async (v) => {
                
                await setTheme(v ? 'dark' : 'light');
              }}
              trackColor={{ false: '#E2E8F0', true: '#F97316' }}
              thumbColor={'#FFF'}
            />
          </View>
        </View>

        {/* Features */}
        {(!activeStaff || activePermissions?.notes) && (
          <>
            <SectionHeader title="Features" />
            <View style={[styles.card, SHADOW.sm]}>
              <SettingRow
                icon="document-text-outline"
                label="Notes"
                subtitle="Manage your business notes and reminders"
                onPress={() => router.push('/notes')}
              />
            </View>
          </>
        )}

        {/* Security */}
        <SectionHeader title="Security" />
        <View style={[styles.card, SHADOW.sm]}>
          <SettingRow
            icon="key-outline"
            label="Change My MPIN"
            subtitle="Update your 4-digit security code"
            onPress={() => {
              setCurrentMpin('');
              setNewMpin('');
              setConfirmNewMpin('');
              setChangeMpinModalVisible(true);
            }}
          />
          {!activeStaff && (
            <>
              <View style={styles.divider} />
              <SettingRow
                icon="lock-closed-outline"
                label="Switch to Staff Mode"
                subtitle="Lock dashboard or change user profile"
                onPress={() => {
                  setPinError('');
                  setPinText('');
                  setPinModalVisible(true);
                }}
              />
            </>
          )}
        </View>

        {!activeStaff && (
          <>
            {/* Preferences */}
            <SectionHeader title="Preferences" />
            
            {/* Language Selector */}
            <View style={[styles.card, styles.languageCard, SHADOW.sm]}>
              {(['en', 'ta'] as const).map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[
                    styles.languageSegment,
                    language === lang && { backgroundColor: '#F97316' },
                  ]}
                  onPress={async () => {
                    
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

            {/* Integration — Google Sheets */}
            <SectionHeader title="Google Sheets Sync" />
            <View style={[styles.card, SHADOW.sm]}>
              {/* Connection Status Header */}
              <View style={styles.sheetsHeader}>
                <View style={styles.sheetsTitleRow}>
                  <Ionicons name="document-text-outline" size={20} color="#64748B" style={{marginRight: 12}} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>Google Sheets</Text>
                    <View style={styles.statusRow}>
                      <Text style={{ fontSize: 14 }}>{getStatusIndicator().emoji}</Text>
                      <Text style={[styles.statusText, { color: getStatusIndicator().color }]}>
                        {getStatusIndicator().label}
                      </Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity 
                  style={[styles.connectBtn, { backgroundColor: connectionStatus === 'connected' ? '#F1F5F9' : '#F97316' }]}
                  onPress={() => handleVerifySheets(false)}
                  disabled={verifying}
                >
                  {verifying ? (
                    <ActivityIndicator size="small" color={connectionStatus === 'connected' ? '#F97316' : '#FFF'} />
                  ) : (
                    <Text style={[styles.connectBtnText, { color: connectionStatus === 'connected' ? '#F97316' : '#FFF' }]}>
                      {connectionStatus === 'connected' ? 'Reconnect' : 'Connect'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Sync Details */}
              <View style={styles.divider} />
              <View style={{ padding: 16, gap: 10 }}>
                {/* Last Sync Time */}
                <View style={styles.syncInfoRow}>
                  <Ionicons name="time-outline" size={16} color="#94A3B8" />
                  <Text style={styles.syncInfoLabel}>Last Sync</Text>
                  <Text style={styles.syncInfoValue}>{formatLastSync(lastSyncedAt)}</Text>
                </View>

                {/* Pending Records */}
                <View style={styles.syncInfoRow}>
                  <Ionicons name="cloud-upload-outline" size={16} color="#94A3B8" />
                  <Text style={styles.syncInfoLabel}>Pending</Text>
                  <View style={[styles.pendingBadge, pendingCount > 0 && { backgroundColor: '#FEF3C7' }]}>
                    <Text style={[styles.pendingBadgeText, pendingCount > 0 && { color: '#D97706' }]}>
                      {pendingCount} record{pendingCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                {/* Error message */}
                {syncError && (
                  <View style={styles.syncErrorBox}>
                    <Ionicons name="warning-outline" size={14} color="#B91C1C" />
                    <Text style={styles.syncErrorText} numberOfLines={2}>{syncError}</Text>
                  </View>
                )}

                {/* Retry / Clear buttons */}
                {pendingCount > 0 && (
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                    <TouchableOpacity
                      style={[styles.syncActionBtn, { backgroundColor: '#F97316' }]}
                      onPress={handleRetrySync}
                    >
                      <Ionicons name="refresh-outline" size={16} color="#FFF" />
                      <Text style={[styles.syncActionBtnText, { color: '#FFF' }]}>Retry All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.syncActionBtn, { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' }]}
                      onPress={() => {
                        Alert.alert(
                          'Clear Pending',
                          `Are you sure you want to clear ${pendingCount} pending sync records? This data will NOT be synced to Google Sheets.`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Clear', style: 'destructive', onPress: clearPending },
                          ]
                        );
                      }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#B91C1C" />
                      <Text style={[styles.syncActionBtnText, { color: '#B91C1C' }]}>Clear</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </>
        )}

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

      {/* Pinpad Modal Overlay */}
      <Modal visible={pinModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.pinpadCard, SHADOW.lg]}>
            <TouchableOpacity 
              style={styles.closeBtn} 
              onPress={() => setPinModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#0F172A" />
            </TouchableOpacity>

            <Text style={styles.pinTitle}>Enter MPIN</Text>
            <Text style={styles.pinSubtitle}>
              {activeStaff ? 'Enter Owner MPIN to switch back' : 'Enter Staff or Owner MPIN'}
            </Text>

            {/* Dots */}
            <View style={styles.dotsRow}>
              {[0, 1, 2, 3].map((index) => (
                <View 
                  key={index} 
                  style={[
                    styles.dot, 
                    pinText.length > index && styles.dotFilled,
                    pinError.length > 0 && styles.dotError
                  ]} 
                />
              ))}
            </View>

            {pinError.length > 0 && (
              <Text style={styles.errorText}>{pinError}</Text>
            )}

            {/* Grid */}
            <View style={styles.grid}>
              {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, rIndex) => (
                <View key={rIndex} style={styles.gridRow}>
                  {row.map((digit) => (
                    <TouchableOpacity 
                      key={digit} 
                      style={styles.keyBtn}
                      onPress={() => handlePinPress(digit)}
                    >
                      <Text style={styles.keyText}>{digit}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
              <View style={styles.gridRow}>
                <View style={styles.keyBtnEmpty} />
                <TouchableOpacity 
                  style={styles.keyBtn}
                  onPress={() => handlePinPress('0')}
                >
                  <Text style={styles.keyText}>0</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.keyBtn}
                  onPress={handlePinBackspace}
                >
                  <Ionicons name="backspace-outline" size={24} color="#0F172A" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Change MPIN Modal Overlay */}
      <Modal visible={changeMpinModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modal, { backgroundColor: '#F8F9FA' }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Change My MPIN</Text>
            <TouchableOpacity onPress={() => setChangeMpinModalVisible(false)}>
              <Ionicons name="close" size={24} color="#0F172A" />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView 
            style={{ flex: 1 }} 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <View style={[styles.card, { padding: 24, gap: 16 }]}>
                <Input
                  label="Current 4-Digit MPIN"
                  value={currentMpin}
                  onChangeText={setCurrentMpin}
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={4}
                  placeholder="Enter current MPIN"
                />
                <Input
                  label="New 4-Digit MPIN"
                  value={newMpin}
                  onChangeText={setNewMpin}
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={4}
                  placeholder="Enter new MPIN"
                />
                <Input
                  label="Confirm New 4-Digit MPIN"
                  value={confirmNewMpin}
                  onChangeText={setConfirmNewMpin}
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={4}
                  placeholder="Confirm new MPIN"
                />
                <Button
                  title={changingMpin ? "Updating..." : "Update MPIN"}
                  onPress={handleChangeMpin}
                  loading={changingMpin}
                  fullWidth
                  size="lg"
                  style={{ marginTop: 8 }}
                />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  modal: { flex: 1, backgroundColor: '#F8F9FA' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalContent: { padding: 20 },
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
  roleBadgeStaff: {
    backgroundColor: '#E0F2FE',
    borderColor: '#BAE6FD',
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EA580C',
  },
  roleTextStaff: {
    color: '#0284C7',
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

  // PIN Pad Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  pinpadCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  closeBtn: {
    alignSelf: 'flex-end',
    padding: 4,
  },
  pinTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  pinSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 24,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#CBD5E1',
  },
  dotFilled: {
    backgroundColor: '#F97316',
    borderColor: '#F97316',
  },
  dotError: {
    borderColor: '#EF4444',
    backgroundColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 16,
  },
  grid: {
    width: '100%',
    maxWidth: 280,
    gap: 12,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  keyBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  keyBtnEmpty: {
    width: 64,
    height: 64,
  },
  keyText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
  },

  // Google Sheets Sync Styles
  syncInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncInfoLabel: {
    fontSize: 13,
    color: '#64748B',
    flex: 1,
  },
  syncInfoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  pendingBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  pendingBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  syncErrorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  syncErrorText: {
    fontSize: 12,
    color: '#B91C1C',
    flex: 1,
    lineHeight: 16,
  },
  syncActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  syncActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
