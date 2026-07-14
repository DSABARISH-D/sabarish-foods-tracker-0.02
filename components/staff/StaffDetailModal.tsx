import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SHADOW } from '@/constants/theme';
import { Staff, SalaryPayment, StaffPermissions } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { useStaffStore } from '@/store/staffStore';
import { AppTextInput } from '@/components/ui/AppTextInput';

interface Props {
  visible: boolean;
  staff: Staff;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function StaffDetailModal({ visible, staff, onClose, onEdit, onDelete }: Props) {
  const { changeMpin, changeStatus, paySalary, getSalarySummary, loadPermissions, setPermissions, currentPermissions } = useStaffStore();
  const [tab, setTab] = useState<'info' | 'salary' | 'permissions'>('info');
  const [mpinModal, setMpinModal] = useState(false);
  const [newMpin, setNewMpin] = useState('');
  const [salaryData, setSalaryData] = useState<{ monthly_salary: number; total_paid: number; pending: number; payments: SalaryPayment[] } | null>(null);
  const [salaryMonth, setSalaryMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });

  useEffect(() => {
    if (visible && staff) {
      loadSalary();
      loadPermissions(staff.id);
    }
  }, [visible, staff?.id]);

  const loadSalary = async () => {
    try { const data = await getSalarySummary(staff.id); setSalaryData(data); } catch {}
  };

  const handleResetMpin = async () => {
    if (!newMpin || newMpin.length !== 4 || !/^\d{4}$/.test(newMpin)) { Alert.alert('Error', '4-digit MPIN required'); return; }
    try { await changeMpin(staff.id, newMpin); setMpinModal(false); setNewMpin(''); Alert.alert('Success', 'MPIN reset'); } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const handleToggleStatus = () => {
    const newStatus = staff.status === 'active' ? 'inactive' : 'active';
    Alert.alert('Confirm', `Mark ${staff.full_name} as ${newStatus}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', onPress: () => changeStatus(staff.id, newStatus) },
    ]);
  };

  const handlePaySalary = () => {
    Alert.alert('Pay Salary', `Pay ${formatCurrency(staff.monthly_salary)} to ${staff.full_name} for ${salaryMonth}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Pay', onPress: async () => {
        try { await paySalary(staff.id, staff.full_name, staff.monthly_salary, salaryMonth); loadSalary(); Alert.alert('Success', 'Salary paid & expense recorded'); } catch (e: any) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  const togglePerm = (key: keyof Pick<StaffPermissions, 'dashboard' | 'expenses' | 'inventory' | 'credit' | 'reports' | 'settings'>) => {
    if (!currentPermissions) return;
    setPermissions(staff.id, { [key]: !currentPermissions[key] });
  };

  const TABS = [
    { key: 'info' as const, label: 'Info', icon: 'person-outline' as const },
    { key: 'salary' as const, label: 'Salary', icon: 'cash-outline' as const },
    { key: 'permissions' as const, label: 'Access', icon: 'shield-outline' as const },
  ];

  const PERM_ITEMS: { key: keyof Pick<StaffPermissions, 'dashboard' | 'expenses' | 'inventory' | 'credit' | 'reports' | 'settings'>; label: string; icon: any }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: 'home-outline' },
    { key: 'expenses', label: 'Expenses', icon: 'receipt-outline' },
    { key: 'inventory', label: 'Inventory', icon: 'cube-outline' },
    { key: 'credit', label: 'Credit', icon: 'people-outline' },
    { key: 'reports', label: 'Reports', icon: 'bar-chart-outline' },
    { key: 'settings', label: 'Settings', icon: 'settings-outline' },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color="#0F172A" /></TouchableOpacity>
          <Text style={s.headerTitle}>{staff.full_name}</Text>
          <TouchableOpacity onPress={onEdit}><Ionicons name="create-outline" size={22} color="#F97316" /></TouchableOpacity>
        </View>

        <View style={s.tabRow}>
          {TABS.map(t => (
            <TouchableOpacity key={t.key} style={[s.tab, tab === t.key && s.tabActive]} onPress={() => setTab(t.key)}>
              <Ionicons name={t.icon} size={16} color={tab === t.key ? '#FFF' : '#64748B'} />
              <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={s.body} showsVerticalScrollIndicator={false}>
          {tab === 'info' && (
            <>
              <View style={[s.card, SHADOW.sm]}>
                <InfoRow icon="call-outline" label="Phone" value={staff.phone_number} />
                <InfoRow icon="briefcase-outline" label="Role" value={staff.role.charAt(0).toUpperCase() + staff.role.slice(1)} />
                <InfoRow icon="cash-outline" label="Salary" value={formatCurrency(staff.monthly_salary)} />
                <InfoRow icon="calendar-outline" label="Joined" value={staff.joining_date} />
                <InfoRow icon="radio-button-on-outline" label="Status" value={staff.status === 'active' ? 'Active ✅' : 'Inactive ❌'} />
              </View>
              <Text style={s.actionsTitle}>Actions</Text>
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#FFF7ED' }]} onPress={() => setMpinModal(true)}>
                <Ionicons name="key-outline" size={20} color="#F97316" /><Text style={[s.actionText, { color: '#F97316' }]}>Reset MPIN</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: staff.status === 'active' ? '#FEF3C7' : '#DCFCE7' }]} onPress={handleToggleStatus}>
                <Ionicons name={staff.status === 'active' ? 'pause-circle-outline' : 'play-circle-outline'} size={20} color={staff.status === 'active' ? '#D97706' : '#16A34A'} />
                <Text style={[s.actionText, { color: staff.status === 'active' ? '#D97706' : '#16A34A' }]}>{staff.status === 'active' ? 'Deactivate' : 'Activate'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#FEE2E2' }]} onPress={onDelete}>
                <Ionicons name="trash-outline" size={20} color="#DC2626" /><Text style={[s.actionText, { color: '#DC2626' }]}>Delete Account</Text>
              </TouchableOpacity>
            </>
          )}

          {tab === 'salary' && (
            <>
              <View style={[s.card, SHADOW.sm]}>
                <InfoRow icon="cash-outline" label="Monthly Salary" value={formatCurrency(salaryData?.monthly_salary ?? staff.monthly_salary)} />
                <InfoRow icon="checkmark-circle-outline" label="Total Paid" value={formatCurrency(salaryData?.total_paid ?? 0)} />
                <InfoRow icon="alert-circle-outline" label="Pending" value={formatCurrency(salaryData?.pending ?? 0)} />
              </View>
              <View style={s.salaryMonthRow}>
                <Text style={s.salaryLabel}>Month:</Text>
                <AppTextInput style={s.monthInput} value={salaryMonth} onChangeText={setSalaryMonth} placeholder="YYYY-MM" placeholderTextColor="#94A3B8" />
              </View>
              <TouchableOpacity style={s.payBtn} onPress={handlePaySalary}>
                <Ionicons name="checkmark-circle" size={20} color="#FFF" /><Text style={s.payBtnText}>Mark Salary Paid</Text>
              </TouchableOpacity>
              {salaryData && salaryData.payments.length > 0 && (
                <View style={{ marginTop: 20 }}>
                  <Text style={s.actionsTitle}>Payment History</Text>
                  {salaryData.payments.map(p => (
                    <View key={p.id} style={[s.historyRow, SHADOW.sm]}>
                      <View><Text style={s.historyMonth}>{p.salary_month}</Text><Text style={s.historyDate}>{p.paid_date}</Text></View>
                      <Text style={s.historyAmount}>{formatCurrency(p.amount)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          {tab === 'permissions' && (
            <View style={[s.card, SHADOW.sm]}>
              {PERM_ITEMS.map(p => (
                <TouchableOpacity key={p.key} style={s.permRow} onPress={() => togglePerm(p.key)}>
                  <Ionicons name={p.icon} size={20} color="#64748B" />
                  <Text style={s.permLabel}>{p.label}</Text>
                  <View style={[s.toggle, currentPermissions?.[p.key] && s.toggleOn]}>
                    <View style={[s.toggleDot, currentPermissions?.[p.key] && s.toggleDotOn]} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>

        {/* MPIN Reset Modal */}
        <Modal visible={mpinModal} transparent animationType="fade">
          <View style={s.overlay}>
            <View style={[s.mpinCard, SHADOW.lg]}>
              <Text style={s.mpinTitle}>Reset MPIN</Text>
              <AppTextInput style={s.mpinInput} value={newMpin} onChangeText={setNewMpin} placeholder="New 4-digit MPIN" keyboardType="number-pad" secureTextEntry maxLength={4} placeholderTextColor="#94A3B8" />
              <View style={s.mpinBtns}>
                <TouchableOpacity style={s.mpinCancel} onPress={() => { setMpinModal(false); setNewMpin(''); }}><Text style={s.mpinCancelText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={s.mpinSave} onPress={handleResetMpin}><Text style={s.mpinSaveText}>Reset</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

function InfoRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={s.infoRow}><Ionicons name={icon} size={18} color="#64748B" /><Text style={s.infoLabel}>{label}</Text><Text style={s.infoValue}>{value}</Text></View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  tabRow: { flexDirection: 'row', gap: 8, padding: 16, paddingHorizontal: 20, backgroundColor: '#FFF' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F1F5F9' },
  tabActive: { backgroundColor: '#0F172A' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#FFF' },
  body: { flex: 1, padding: 20 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F8F9FA' },
  infoLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: '#64748B', marginLeft: 12 },
  infoValue: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  actionsTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginTop: 20, marginBottom: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 14, marginBottom: 8 },
  actionText: { fontSize: 14, fontWeight: '600' },
  salaryMonthRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  salaryLabel: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  monthInput: { flex: 1, backgroundColor: '#FFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', fontSize: 15, color: '#0F172A' },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#22C55E', borderRadius: 14, padding: 16, marginTop: 16 },
  payBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#F1F5F9' },
  historyMonth: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  historyDate: { fontSize: 12, color: '#64748B', marginTop: 2 },
  historyAmount: { fontSize: 15, fontWeight: '800', color: '#22C55E' },
  permRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F8F9FA' },
  permLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: '#0F172A', marginLeft: 12 },
  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#E2E8F0', justifyContent: 'center', paddingHorizontal: 2 },
  toggleOn: { backgroundColor: '#22C55E' },
  toggleDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF' },
  toggleDotOn: { alignSelf: 'flex-end' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 30 },
  mpinCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 24 },
  mpinTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 16 },
  mpinInput: { backgroundColor: '#F8F9FA', borderRadius: 12, padding: 16, fontSize: 20, textAlign: 'center', letterSpacing: 8, borderWidth: 1, borderColor: '#E2E8F0', color: '#0F172A' },
  mpinBtns: { flexDirection: 'row', gap: 12, marginTop: 20 },
  mpinCancel: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center' },
  mpinCancelText: { fontSize: 15, fontWeight: '600', color: '#64748B' },
  mpinSave: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#F97316', alignItems: 'center' },
  mpinSaveText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
