import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SHADOW } from '@/constants/theme';
import { Staff, StaffForm, StaffRole, StaffStatus } from '@/types';

const ROLES: { key: StaffRole; label: string }[] = [
  { key: 'cook', label: 'Cook' }, { key: 'cashier', label: 'Cashier' },
  { key: 'server', label: 'Server' }, { key: 'delivery', label: 'Delivery' },
  { key: 'cleaner', label: 'Cleaner' }, { key: 'manager', label: 'Manager' },
  { key: 'other', label: 'Other' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (form: StaffForm) => Promise<void>;
  editingStaff?: Staff | null;
  isOwnerAccount?: boolean;
}

export function AddStaffModal({ visible, onClose, onSave, editingStaff, isOwnerAccount }: Props) {
  const [name, setName] = useState(editingStaff?.full_name || '');
  const [phone, setPhone] = useState(editingStaff?.phone_number || '');
  const [role, setRole] = useState<StaffRole>(editingStaff?.role || (isOwnerAccount ? 'owner' : 'cook'));
  const [mpin, setMpin] = useState('');
  const [salary, setSalary] = useState(editingStaff?.monthly_salary?.toString() || '');
  const [status, setStatus] = useState<StaffStatus>(editingStaff?.status || 'active');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Error', 'Name is required'); return; }
    if (!phone.trim() || phone.length < 10) { Alert.alert('Error', 'Valid phone number required'); return; }
    if (!editingStaff && (!mpin || mpin.length !== 4)) { Alert.alert('Error', '4-digit MPIN required'); return; }
    if (!editingStaff && !/^\d{4}$/.test(mpin)) { Alert.alert('Error', 'MPIN must be 4 digits'); return; }

    setSaving(true);
    try {
      await onSave({
        full_name: name.trim(),
        phone_number: phone.trim(),
        role: isOwnerAccount ? 'owner' : role,
        mpin: mpin || '0000',
        monthly_salary: parseFloat(salary) || 0,
        joining_date: editingStaff?.joining_date || new Date().toISOString().split('T')[0],
        status,
      });
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color="#0F172A" /></TouchableOpacity>
          <Text style={styles.modalTitle}>{editingStaff ? 'Edit' : 'Add'} {isOwnerAccount ? 'Owner' : 'Staff'}</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView style={styles.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.label}>Full Name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Enter full name" placeholderTextColor="#94A3B8" />

          <Text style={styles.label}>Phone Number *</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="10-digit number" keyboardType="phone-pad" placeholderTextColor="#94A3B8" maxLength={10} />

          {!editingStaff && (
            <>
              <Text style={styles.label}>4-digit MPIN *</Text>
              <TextInput style={styles.input} value={mpin} onChangeText={setMpin} placeholder="••••" keyboardType="number-pad" secureTextEntry maxLength={4} placeholderTextColor="#94A3B8" />
            </>
          )}

          {!isOwnerAccount && (
            <>
              <Text style={styles.label}>Role</Text>
              <View style={styles.roleGrid}>
                {ROLES.map(r => (
                  <TouchableOpacity key={r.key} style={[styles.roleChip, role === r.key && styles.roleChipActive]} onPress={() => setRole(r.key)}>
                    <Text style={[styles.roleChipText, role === r.key && styles.roleChipTextActive]}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Monthly Salary (₹)</Text>
              <TextInput style={styles.input} value={salary} onChangeText={setSalary} placeholder="0" keyboardType="decimal-pad" placeholderTextColor="#94A3B8" />
            </>
          )}

          <Text style={styles.label}>Status</Text>
          <View style={styles.statusRow}>
            {(['active', 'inactive'] as StaffStatus[]).map(s => (
              <TouchableOpacity key={s} style={[styles.statusBtn, status === s && (s === 'active' ? styles.statusActive : styles.statusInactive)]} onPress={() => setStatus(s)}>
                <Text style={[styles.statusBtnText, status === s && styles.statusBtnTextActive]}>
                  {s === 'active' ? 'Active' : 'Inactive'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : editingStaff ? 'Update' : 'Add'}</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: { flex: 1, backgroundColor: '#F8F9FA' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  form: { flex: 1, padding: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, fontSize: 15, color: '#0F172A', borderWidth: 1, borderColor: '#E2E8F0' },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0' },
  roleChipActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  roleChipText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  roleChipTextActive: { color: '#FFF' },
  statusRow: { flexDirection: 'row', gap: 12 },
  statusBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#FFF', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  statusActive: { backgroundColor: '#DCFCE7', borderColor: '#22C55E' },
  statusInactive: { backgroundColor: '#FEE2E2', borderColor: '#EF4444' },
  statusBtnText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  statusBtnTextActive: { color: '#0F172A' },
  saveBtn: { backgroundColor: '#F97316', borderRadius: 16, padding: 18, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
