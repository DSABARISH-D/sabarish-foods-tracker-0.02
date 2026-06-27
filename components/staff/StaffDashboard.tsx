import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SHADOW } from '@/constants/theme';

interface Props {
  total: number;
  active: number;
  inactive: number;
}

export function StaffDashboard({ total, active, inactive }: Props) {
  return (
    <View style={styles.container}>
      <DashCard icon="people" label="Total Staff" value={total} color="#3B82F6" bg="#DBEAFE" />
      <DashCard icon="checkmark-circle" label="Active" value={active} color="#22C55E" bg="#DCFCE7" />
      <DashCard icon="close-circle" label="Inactive" value={inactive} color="#EF4444" bg="#FEE2E2" />
    </View>
  );
}

function DashCard({ icon, label, value, color, bg }: { icon: any; label: string; value: number; color: string; bg: string }) {
  return (
    <View style={[styles.card, SHADOW.sm]}>
      <View style={[styles.iconWrap, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', gap: 12, paddingHorizontal: 20 },
  card: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 16, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9',
  },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  value: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  label: { fontSize: 12, fontWeight: '600', color: '#64748B', marginTop: 4 },
});
