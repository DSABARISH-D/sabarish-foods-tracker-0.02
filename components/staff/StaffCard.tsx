import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SHADOW } from '@/constants/theme';
import { Staff } from '@/types';
import { formatCurrency } from '@/lib/utils';

const ROLE_COLORS: Record<string, string> = {
  cook: '#F97316', cashier: '#3B82F6', server: '#8B5CF6', delivery: '#06B6D4',
  cleaner: '#22C55E', manager: '#EF4444', owner: '#F59E0B', other: '#64748B',
};

interface Props {
  staff: Staff;
  onPress: (staff: Staff) => void;
}

export function StaffCard({ staff, onPress }: Props) {
  const roleColor = ROLE_COLORS[staff.role] || '#64748B';
  return (
    <TouchableOpacity style={[styles.card, SHADOW.sm]} onPress={() => onPress(staff)} activeOpacity={0.7}>
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: roleColor + '20' }]}>
          <Text style={[styles.avatarText, { color: roleColor }]}>
            {staff.full_name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{staff.full_name}</Text>
          <View style={styles.metaRow}>
            <View style={[styles.roleBadge, { backgroundColor: roleColor + '15' }]}>
              <Text style={[styles.roleText, { color: roleColor }]}>
                {staff.role.charAt(0).toUpperCase() + staff.role.slice(1)}
              </Text>
            </View>
            <View style={styles.phoneBadge}>
              <Ionicons name="call-outline" size={11} color="#64748B" />
              <Text style={styles.phone}>{staff.phone_number}</Text>
            </View>
          </View>
        </View>
        <View style={styles.right}>
          <Text style={styles.salary}>{formatCurrency(staff.monthly_salary)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: staff.status === 'active' ? '#DCFCE7' : '#FEE2E2' }]}>
            <View style={[styles.statusDot, { backgroundColor: staff.status === 'active' ? '#22C55E' : '#EF4444' }]} />
            <Text style={[styles.statusText, { color: staff.status === 'active' ? '#16A34A' : '#DC2626' }]}>
              {staff.status === 'active' ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginHorizontal: 20, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800' },
  info: { flex: 1, marginLeft: 12 },
  name: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  roleText: { fontSize: 11, fontWeight: '700' },
  phoneBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  phone: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  right: { alignItems: 'flex-end' },
  salary: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },
});
