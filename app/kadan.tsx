import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useKadanStore, useAuthStore } from '@/store';
import { KadanCard } from '@/components/kadan/KadanCard';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { SHADOW } from '@/constants/theme';
import { useTranslation } from '@/hooks/useTranslation';
import { KadanForm, KadanStatus } from '@/types';
import { validateMobile, validateAmount, formatCurrency, getTodayDate } from '@/lib/utils';
import { Ionicons } from '@expo/vector-icons';
import { AppTextInput } from '@/components/ui/AppTextInput';

type FilterType = 'all' | KadanStatus;

export default function KadanScreen() {
  const { kadanList, kadanLoading, loadKadan, addKadan, removeKadan, markPaid } = useKadanStore();
  const { activeStaff, activePermissions } = useAuthStore();
  const { t } = useTranslation();

  useEffect(() => {
    if (activeStaff && !activePermissions?.credit) {
      
      router.replace('/tabs');
    }
  }, [activeStaff, activePermissions]);

  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState<KadanForm>({
    customer_name: '',
    mobile_number: '',
    amount: 0,
    due_date: getTodayDate(),
    notes: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof KadanForm, string>>>({});

  useEffect(() => { loadKadan(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadKadan();
    setRefreshing(false);
  };

  const filteredList = kadanList.filter((k) => {
    const matchSearch = k.customer_name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || k.status === filter;
    return matchSearch && matchFilter;
  });

  const totalPending = kadanList
    .filter((k) => k.status === 'pending' || k.status === 'overdue')
    .reduce((s, k) => s + k.amount, 0);

  const validate = () => {
    const e: Partial<Record<keyof KadanForm, string>> = {};
    if (!form.customer_name.trim()) e.customer_name = t('errors.required') || 'Required';
    if (!validateMobile(form.mobile_number)) e.mobile_number = t('errors.invalid_mobile') || 'Invalid mobile';
    if (!validateAmount(form.amount.toString())) e.amount = t('errors.invalid_amount') || 'Invalid amount';
    if (!form.due_date) e.due_date = t('errors.required') || 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await addKadan(form);
      setShowModal(false);
      setForm({ customer_name: '', mobile_number: '', amount: 0, due_date: getTodayDate(), notes: '' });
      
    } catch {
      Alert.alert(t('common.error') || 'Error', t('errors.unknown') || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: 'all', label: t('kadan.filter_all') || 'All' },
    { key: 'pending', label: t('kadan.filter_pending') || 'Pending' },
    { key: 'paid', label: t('kadan.filter_paid') || 'Paid' },
    { key: 'overdue', label: t('kadan.filter_overdue') || 'Overdue' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#0F172A" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Credit (Kadan)</Text>
            <Text style={styles.headerSubtitle}>Customer Credit</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, SHADOW.sm]}
          onPress={() => {
            setShowModal(true);
            
          }}
        >
          <Ionicons name="add" size={24} color="#F97316" />
        </TouchableOpacity>
      </View>

      {/* Total Pending Card */}
      {totalPending > 0 && (
        <View style={styles.pendingCard}>
          <Text style={styles.pendingLabel}>{t('kadan.total_pending') || 'Total Pending'}</Text>
          <Text style={styles.pendingAmount}>{formatCurrency(totalPending)}</Text>
        </View>
      )}

      {/* Search */}
      <View style={[styles.searchWrap, SHADOW.sm]}>
        <Ionicons name="search-outline" size={20} color="#94A3B8" />
        <AppTextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search customers..."
          placeholderTextColor="#94A3B8"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: filter === f.key ? '#0F172A' : '#FFF',
                  borderColor: filter === f.key ? '#0F172A' : '#E2E8F0',
                },
              ]}
            >
              <Text
                style={[
                  styles.filterLabel,
                  { color: filter === f.key ? '#FFF' : '#475569' },
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* List */}
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />
        }
        showsVerticalScrollIndicator={false}
      >
        {kadanLoading && kadanList.length === 0 ? (
          <ListSkeleton count={5} />
        ) : filteredList.length === 0 ? (
          <EmptyState
            emoji="📋"
            title={t('kadan.empty') || 'No credit records'}
            actionLabel={t('kadan.add_kadan') || 'Add Credit'}
            onAction={() => setShowModal(true)}
          />
        ) : (
          filteredList.map((kadan) => (
            <KadanCard
              key={kadan.id}
              kadan={kadan}
              onMarkPaid={markPaid}
              onDelete={removeKadan}
              onEdit={() => {}}
            />
          ))
        )}
      </ScrollView>

      {/* Add Kadan Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('kadan.add_kadan') || 'Add Credit'}</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={24} color="#0F172A" />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView contentContainerStyle={styles.modalForm} keyboardShouldPersistTaps="handled">
              <View style={[styles.formCard, SHADOW.sm]}>
                <Input
                  label={t('kadan.customer_name') || 'Customer Name'}
                  value={form.customer_name}
                  onChangeText={(v) => setForm({ ...form, customer_name: v })}
                  error={errors.customer_name}
                  required
                  autoCapitalize="words"
                />
                <Input
                  label={t('kadan.mobile_number') || 'Mobile Number'}
                  value={form.mobile_number}
                  onChangeText={(v) => setForm({ ...form, mobile_number: v })}
                  error={errors.mobile_number}
                  keyboardType="phone-pad"
                  maxLength={10}
                  required
                />
                <Input
                  label={t('kadan.amount') || 'Amount'}
                  value={form.amount > 0 ? form.amount.toString() : ''}
                  onChangeText={(v) => setForm({ ...form, amount: parseFloat(v) || 0 })}
                  error={errors.amount}
                  keyboardType="decimal-pad"
                  prefix="₹"
                  required
                />
                <Input
                  label={t('kadan.due_date') || 'Due Date'}
                  value={form.due_date}
                  onChangeText={(v) => setForm({ ...form, due_date: v })}
                  error={errors.due_date}
                  placeholder="YYYY-MM-DD"
                  required
                />
                <Input
                  label={t('kadan.notes') || 'Notes'}
                  value={form.notes ?? ''}
                  onChangeText={(v) => setForm({ ...form, notes: v })}
                  multiline
                  numberOfLines={3}
                  placeholder="Optional notes..."
                />
                <Button
                  title={saving ? (t('common.loading') || 'Saving...') : (t('kadan.save') || 'Save')}
                  onPress={handleSave}
                  loading={saving}
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
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  headerTitle: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  pendingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 20,
    padding: 20,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  pendingLabel: { fontSize: 14, fontWeight: '600', color: '#EF4444' },
  pendingAmount: { fontSize: 24, fontWeight: '800', color: '#B91C1C' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 20,
    marginBottom: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    height: 50,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#0F172A' },
  filterScroll: { maxHeight: 50 },
  filterRow: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterLabel: { fontSize: 13, fontWeight: '600' },
  list: { padding: 20, paddingBottom: 40 },
  
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
  modalForm: { padding: 20 },
  formCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
});
