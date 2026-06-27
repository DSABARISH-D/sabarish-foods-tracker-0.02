import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SHADOW } from '@/constants/theme';
import { useStaffStore } from '@/store/staffStore';
import { useAuthStore } from '@/store';
import { Staff, StaffForm, LoginHistoryEntry } from '@/types';
import { StaffDashboard } from '@/components/staff/StaffDashboard';
import { StaffCard } from '@/components/staff/StaffCard';
import { AddStaffModal } from '@/components/staff/AddStaffModal';
import { StaffDetailModal } from '@/components/staff/StaffDetailModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { router } from 'expo-router';

type TabKey = 'staff' | 'owners' | 'attendance' | 'history';

export default function StaffTabScreen() {
  const { user } = useAuthStore();
  const {
    staffList,
    staffLoading,
    dashboardStats,
    loginHistory,
    attendance,
    attendanceLoading,
    loadStaff,
    loadDashboardStats,
    addStaff,
    editStaff,
    removeStaff,
    loadLoginHistory,
    loadAttendance,
    saveAttendance,
  } = useStaffStore();

  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<TabKey>('staff');
  const [addModal, setAddModal] = useState(false);
  const [addOwnerModal, setAddOwnerModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

  // Attendance Date
  const [attendanceDate, setAttendanceDate] = useState(new Date());

  // Security: Only owners can access Staff Management
  useEffect(() => {
    if (user && user.role !== 'owner') {
      Alert.alert('Access Denied', 'Only owners can access Staff Management');
      router.replace('/tabs');
    }
  }, [user]);

  const dateStr = attendanceDate.toISOString().split('T')[0];

  const load = useCallback(async () => {
    await Promise.all([
      loadStaff(),
      loadDashboardStats(),
      loadLoginHistory(),
      loadAttendance(dateStr),
    ]);
  }, [dateStr]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const changeDate = (days: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newDate = new Date(attendanceDate);
    newDate.setDate(newDate.getDate() + days);
    setAttendanceDate(newDate);
  };

  const handleMarkAttendance = async (staffId: string, status: 'present' | 'absent' | 'half_day' | 'leave') => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await saveAttendance(staffId, dateStr, status);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update attendance');
    }
  };

  const handleAddStaff = async (form: StaffForm) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await addStaff(form);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleEditStaff = async (form: StaffForm) => {
    if (!editingStaff) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { mpin, ...rest } = form;
    await editStaff(editingStaff.id, rest);
    setEditingStaff(null);
    setSelectedStaff(null);
    await loadStaff();
  };

  const handleDeleteStaff = (staff: Staff) => {
    Alert.alert('Delete', `Delete ${staff.full_name}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await removeStaff(staff.id);
          setSelectedStaff(null);
        },
      },
    ]);
  };

  const staffMembers = staffList.filter((s) => s.role !== 'owner');
  const ownerMembers = staffList.filter((s) => s.role === 'owner');
  const activeStaffForAttendance = staffMembers.filter((s) => s.status === 'active');

  const TABS: { key: TabKey; label: string; icon: any }[] = [
    { key: 'staff', label: 'Staff', icon: 'people-outline' },
    { key: 'attendance', label: 'Attendance', icon: 'calendar-outline' },
    { key: 'owners', label: 'Owners', icon: 'shield-outline' },
    { key: 'history', label: 'History', icon: 'time-outline' },
  ];

  const formatDateDisplay = (date: Date) => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const dStr = date.toDateString();
    if (dStr === today.toDateString()) {
      return 'Today';
    } else if (dStr === yesterday.toDateString()) {
      return 'Yesterday';
    }

    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (user?.role !== 'owner') return null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Staff Management</Text>
            <Text style={styles.headerSub}>Team directories & attendance</Text>
          </View>
        </View>

        {/* Dashboard */}
        <StaffDashboard
          total={dashboardStats?.total ?? 0}
          active={dashboardStats?.active ?? 0}
          inactive={dashboardStats?.inactive ?? 0}
        />

        {/* Tabs */}
        <View style={styles.tabContainer}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, tab === t.key && styles.tabActive]}
              onPress={() => {
                setTab(t.key);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Ionicons name={t.icon} size={15} color={tab === t.key ? '#FFF' : '#64748B'} />
              <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Staff List */}
        {tab === 'staff' && (
          <>
            <Text style={styles.sectionTitle}>Staff Members ({staffMembers.length})</Text>
            {staffMembers.length === 0 ? (
              <EmptyState emoji="👥" title="No staff members yet" />
            ) : (
              staffMembers.map((s) => <StaffCard key={s.id} staff={s} onPress={setSelectedStaff} />)
            )}
          </>
        )}

        {/* Attendance Tab */}
        {tab === 'attendance' && (
          <View style={styles.attendanceContainer}>
            {/* Custom Date Selector */}
            <View style={[styles.dateSelector, SHADOW.sm]}>
              <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateArrow}>
                <Ionicons name="chevron-back" size={20} color="#0F172A" />
              </TouchableOpacity>
              <Text style={styles.dateText}>{formatDateDisplay(attendanceDate)}</Text>
              <TouchableOpacity onPress={() => changeDate(1)} style={styles.dateArrow}>
                <Ionicons name="chevron-forward" size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Daily Attendance Board</Text>

            {attendanceLoading ? (
              <View style={styles.loader}>
                <ActivityIndicator size="large" color="#F97316" />
              </View>
            ) : activeStaffForAttendance.length === 0 ? (
              <EmptyState emoji="👥" title="No active staff members for attendance" />
            ) : (
              activeStaffForAttendance.map((s) => {
                const currentStatus = attendance[s.id];
                return (
                  <View key={s.id} style={[styles.attendanceCard, SHADOW.sm]}>
                    <View style={styles.staffHeader}>
                      <View style={styles.staffAvatar}>
                        <Text style={styles.avatarText}>{s.full_name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={styles.staffInfo}>
                        <Text style={styles.staffName}>{s.full_name}</Text>
                        <Text style={styles.staffRole}>
                          {s.role.charAt(0).toUpperCase() + s.role.slice(1)} • {s.phone_number}
                        </Text>
                      </View>
                    </View>

                    {/* Attendance Action Options */}
                    <View style={styles.optionsRow}>
                      <TouchableOpacity
                        style={[
                          styles.optionBtn,
                          styles.presentBtn,
                          currentStatus === 'present' && styles.presentActive,
                        ]}
                        onPress={() => handleMarkAttendance(s.id, 'present')}
                      >
                        <Text style={[styles.optionText, currentStatus === 'present' && styles.optionTextActive]}>
                          Present
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.optionBtn,
                          styles.halfDayBtn,
                          currentStatus === 'half_day' && styles.halfDayActive,
                        ]}
                        onPress={() => handleMarkAttendance(s.id, 'half_day')}
                      >
                        <Text style={[styles.optionText, currentStatus === 'half_day' && styles.optionTextActive]}>
                          Half Day
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.optionBtn,
                          styles.leaveBtn,
                          currentStatus === 'leave' && styles.leaveActive,
                        ]}
                        onPress={() => handleMarkAttendance(s.id, 'leave')}
                      >
                        <Text style={[styles.optionText, currentStatus === 'leave' && styles.optionTextActive]}>
                          Leave
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.optionBtn, styles.absentBtn, currentStatus === 'absent' && styles.absentActive]}
                        onPress={() => handleMarkAttendance(s.id, 'absent')}
                      >
                        <Text style={[styles.optionText, currentStatus === 'absent' && styles.optionTextActive]}>
                          Absent
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* Owners List */}
        {tab === 'owners' && (
          <>
            <Text style={styles.sectionTitle}>Additional Owners ({ownerMembers.length})</Text>
            {ownerMembers.length === 0 ? (
              <EmptyState emoji="🛡️" title="No additional owners" />
            ) : (
              ownerMembers.map((s) => <StaffCard key={s.id} staff={s} onPress={setSelectedStaff} />)
            )}
          </>
        )}

        {/* Login History */}
        {tab === 'history' && (
          <>
            <Text style={styles.sectionTitle}>Login History</Text>
            {loginHistory.length === 0 ? (
              <EmptyState emoji="📋" title="No login history" />
            ) : (
              loginHistory.map((entry: LoginHistoryEntry) => (
                <View key={entry.id} style={[styles.historyCard, SHADOW.sm]}>
                  <View style={styles.historyLeft}>
                    <View
                      style={[
                        styles.historyAvatar,
                        { backgroundColor: entry.user_type === 'owner' ? '#FEF3C7' : '#DBEAFE' },
                      ]}
                    >
                      <Ionicons
                        name={entry.user_type === 'owner' ? 'shield' : 'person'}
                        size={16}
                        color={entry.user_type === 'owner' ? '#F59E0B' : '#3B82F6'}
                      />
                    </View>
                    <View>
                      <Text style={styles.historyName}>{entry.user_name}</Text>
                      <Text style={styles.historyType}>{entry.user_type === 'owner' ? 'Owner' : 'Staff'}</Text>
                    </View>
                  </View>
                  <View style={styles.historyRight}>
                    <Text style={styles.historyDate}>{entry.login_date}</Text>
                    <Text style={styles.historyTime}>
                      {entry.login_time?.slice(0, 5)}{' '}
                      {entry.logout_time ? `→ ${entry.logout_time.slice(0, 5)}` : ''}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      {tab !== 'history' && tab !== 'attendance' && (
        <TouchableOpacity
          style={[styles.fab, SHADOW.lg]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            tab === 'owners' ? setAddOwnerModal(true) : setAddModal(true);
          }}
        >
          <Ionicons name="add" size={28} color="#FFF" />
        </TouchableOpacity>
      )}

      {/* Modals */}
      <AddStaffModal visible={addModal} onClose={() => setAddModal(false)} onSave={handleAddStaff} />
      <AddStaffModal visible={addOwnerModal} onClose={() => setAddOwnerModal(false)} onSave={handleAddStaff} isOwnerAccount />
      {editingStaff && (
        <AddStaffModal
          visible={!!editingStaff}
          onClose={() => setEditingStaff(null)}
          onSave={handleEditStaff}
          editingStaff={editingStaff}
        />
      )}
      {selectedStaff && (
        <StaffDetailModal
          visible={!!selectedStaff}
          staff={selectedStaff}
          onClose={() => setSelectedStaff(null)}
          onEdit={() => {
            setEditingStaff(selectedStaff);
            setSelectedStaff(null);
          }}
          onDelete={() => handleDeleteStaff(selectedStaff)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
  scroll: { paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 10, gap: 12 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  headerSub: { fontSize: 13, fontWeight: '500', color: '#64748B', marginTop: 2 },
  tabContainer: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, marginTop: 20, marginBottom: 16 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  tabActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  tabLabel: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  tabLabelActive: { color: '#FFF' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', paddingHorizontal: 20, marginBottom: 12, marginTop: 4 },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  historyLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  historyAvatar: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  historyName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  historyType: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  historyRight: { alignItems: 'flex-end' },
  historyDate: { fontSize: 12, fontWeight: '600', color: '#0F172A' },
  historyTime: { fontSize: 11, color: '#64748B', marginTop: 2 },

  // Attendance Styling
  attendanceContainer: { flex: 1 },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  dateArrow: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
  },
  dateText: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  loader: { padding: 40, alignItems: 'center' },
  attendanceCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  staffHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  staffAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#F97316' },
  staffInfo: { flex: 1 },
  staffName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  staffRole: { fontSize: 12, fontWeight: '500', color: '#64748B', marginTop: 2 },
  optionsRow: { flexDirection: 'row', gap: 8 },
  optionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    backgroundColor: '#F8F9FA',
    borderColor: '#E2E8F0',
  },
  optionText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  optionTextActive: { color: '#FFF' },

  // Status-specific active buttons
  presentBtn: { borderColor: '#BBF7D0' },
  presentActive: { backgroundColor: '#22C55E', borderColor: '#22C55E' },
  halfDayBtn: { borderColor: '#FED7AA' },
  halfDayActive: { backgroundColor: '#F97316', borderColor: '#F97316' },
  leaveBtn: { borderColor: '#BFDBFE' },
  leaveActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  absentBtn: { borderColor: '#FCA5A5' },
  absentActive: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
});
