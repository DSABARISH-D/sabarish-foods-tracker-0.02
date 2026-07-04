import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useDashboardStore, useInventoryStore, useKadanStore, useCashStore, useAuthStore } from '@/store';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DashboardSkeleton } from '@/components/ui/Skeleton';
import { SHADOW } from '@/constants/theme';
import { getTodayDate, getLocalDateString } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { Ionicons } from '@expo/vector-icons';
import { TrendChart } from '@/components/reports/TrendChart';
import { fetchReportDataByDateRange } from '@/services/supabase.service';
import { ReportDataPoint } from '@/types';
import { useFocusEffect, useRouter } from 'expo-router';
export default function DashboardScreen() {
  const { user, activeStaff, activePermissions } = useAuthStore();
  const { stats, statsLoading, loadStats } = useDashboardStore();
  const { loadInventory } = useInventoryStore();
  const { loadKadan } = useKadanStore();
  const { loadCash, updateCash } = useCashStore();
  const { t } = useTranslation();
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [chartData, setChartData] = useState<ReportDataPoint[]>([]);

  // Cash Edit State
  const [editingField, setEditingField] = useState<'petty' | 'hand' | 'bank' | 'expenses' | null>(null);
  const [editPetty, setEditPetty] = useState('');
  const [editHand, setEditHand] = useState('');
  const [editBank, setEditBank] = useState('');
  const [editExpenses, setEditExpenses] = useState('');
  const [updatingCash, setUpdatingCash] = useState(false);

  const load = useCallback(async () => {
    const dateStr = getLocalDateString(selectedDate);
    
    // Optimistically clear data to avoid flashing stale charts during fetch
    setChartData([]);
    
    await Promise.all([
      loadStats(dateStr), 
      loadInventory(), 
      loadKadan(), 
      loadCash(dateStr)
    ]);
    
    if (user) {
      try {
        const sd = new Date(selectedDate);
        sd.setDate(sd.getDate() - 6);
        const startDateStr = getLocalDateString(sd);
        const data = await fetchReportDataByDateRange(user.id, startDateStr, dateStr);
        setChartData(data);
      } catch (e) {
        setChartData([]);
      }
    }
  }, [selectedDate, user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const s = stats ?? {
    petty_cash: 0, cash_in_hand: 0, cash_in_bank: 0, cash_expenses: 0,
    today_sales: 0, today_expenses: 0, today_profit: 0,
    monthly_sales: 0, monthly_expenses: 0, monthly_profit: 0,
  };

  const handleOpenEditCash = (field: 'petty' | 'hand' | 'bank' | 'expenses') => {
    setEditPetty(s.petty_cash ? s.petty_cash.toString() : '');
    setEditHand(s.cash_in_hand ? s.cash_in_hand.toString() : '');
    setEditBank(s.cash_in_bank ? s.cash_in_bank.toString() : '');
    setEditExpenses(s.cash_expenses ? s.cash_expenses.toString() : '');
    setEditingField(field);
  };

  const handleUpdateCash = async () => {
    setUpdatingCash(true);
    const dateStr = getLocalDateString(selectedDate);
    try {
      await updateCash({
        petty_cash: parseFloat(editPetty) || 0,
        cash_in_hand: parseFloat(editHand) || 0,
        cash_in_bank: parseFloat(editBank) || 0,
        cash_expenses: parseFloat(editExpenses) || 0,
      }, dateStr);
      await load(); // Also refresh the graph when cash changes
      setEditingField(null);
    } finally {
      setUpdatingCash(false);
    }
  };

  const CashCard = ({ label, value, icon, onPress }: { label: string, value: number, icon: any, onPress: () => void }) => (
    <TouchableOpacity style={[styles.card, styles.cashCard, SHADOW.sm]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cashIconWrap}>
        <Ionicons name={icon} size={20} color="#64748B" />
      </View>
      <View>
        <Text style={styles.cashLabel}>{label}</Text>
        <Text style={styles.cashValue}>{formatCurrency(value)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <Text style={styles.restaurantName}>Sabarish Foods</Text>
          <TouchableOpacity style={[styles.card, styles.calendarBtn, SHADOW.sm]} onPress={() => setShowDatePicker(true)}>
            <Ionicons name="calendar-outline" size={18} color="#F97316" />
            <Text style={styles.calendarText}>
              {selectedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
            </Text>
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            onChange={(event, date) => {
              setShowDatePicker(false);
              if (date) setSelectedDate(date);
            }}
          />
        )}

        {statsLoading && !stats ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* Cash Section */}
            <View style={styles.cashGrid}>
              <View style={styles.cashRow}>
                <CashCard label={t('dashboard.petty_cash') || "Petty Cash"} value={s.petty_cash} icon="wallet-outline" onPress={() => handleOpenEditCash('petty')} />
                <CashCard label={t('dashboard.cash_in_hand') || "Cash in Hand"} value={s.cash_in_hand} icon="cash-outline" onPress={() => handleOpenEditCash('hand')} />
              </View>
              <View style={styles.cashRow}>
                <CashCard label={t('dashboard.cash_in_bank') || "UPI PAY"} value={s.cash_in_bank} icon="card-outline" onPress={() => handleOpenEditCash('bank')} />
                <CashCard label={t('dashboard.cash_expenses') || "Cash Expenses"} value={s.cash_expenses || 0} icon="document-text-outline" onPress={() => handleOpenEditCash('expenses')} />
              </View>
            </View>

            {/* Today's Stats */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Today's Overview</Text>
            </View>

            <View style={styles.statsGrid}>
              <View style={[styles.card, styles.statCard, SHADOW.sm]}>
                <View style={[styles.iconBox, { backgroundColor: '#DCFCE7' }]}>
                  <Ionicons name="trending-up-outline" size={20} color="#22C55E" />
                </View>
                <Text style={styles.statLabel}>Today's Sales</Text>
                <Text style={styles.statValue}>{formatCurrency(s.today_sales)}</Text>
              </View>
              
              <TouchableOpacity 
                style={[styles.card, styles.statCard, SHADOW.sm]}
                onPress={() => router.push('/tabs/expenses')}
                activeOpacity={0.7}
              >
                <View style={[styles.iconBox, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="trending-down-outline" size={20} color="#EF4444" />
                </View>
                <Text style={styles.statLabel}>Today's Expenses</Text>
                <Text style={styles.statValue}>{formatCurrency(s.today_expenses)}</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.card, styles.profitCard, SHADOW.sm]}>
              <View style={[styles.iconBox, { backgroundColor: s.today_profit >= 0 ? '#DBEAFE' : '#FEE2E2' }]}>
                <Ionicons name="wallet-outline" size={24} color={s.today_profit >= 0 ? '#3B82F6' : '#EF4444'} />
              </View>
              <View style={styles.profitInfo}>
                <Text style={styles.statLabel}>Today's Profit</Text>
                <Text style={[styles.profitValue, { color: s.today_profit >= 0 ? '#0F172A' : '#EF4444' }]}>
                  {formatCurrency(s.today_profit)}
                </Text>
              </View>
            </View>

            {/* Sales Analytics Chart */}
            <View style={{ marginTop: 8 }}>
              <TrendChart
                data={chartData}
                title="Sales & Expenses Breakdown"
                type="pie"
                color="#F97316"
              />
            </View>

            <View style={{ height: 20 }} />
          </>
        )}
      </ScrollView>

      {/* Edit Cash Modal */}
      <Modal visible={editingField !== null} animationType="slide" presentationStyle="formSheet">
        <SafeAreaView style={[styles.modal, { backgroundColor: '#F8F9FA' }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Edit {editingField === 'petty' ? 'Petty Cash' :
                     editingField === 'hand' ? 'Cash in Hand' :
                     editingField === 'bank' ? 'UPI PAY' : 'Cash Expenses'}
            </Text>
            <TouchableOpacity onPress={() => setEditingField(null)}>
              <Ionicons name="close" size={24} color="#0F172A" />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.modalContent}>
              <View style={[styles.card, { padding: 20 }, SHADOW.sm]}>
                {editingField === 'petty' && (
                  <Input label="Petty Cash" value={editPetty} onChangeText={setEditPetty} keyboardType="numeric" placeholder="Enter amount" autoFocus />
                )}
                {editingField === 'hand' && (
                  <Input label="Cash in Hand" value={editHand} onChangeText={setEditHand} keyboardType="numeric" placeholder="Enter amount" autoFocus />
                )}
                {editingField === 'bank' && (
                  <Input label="UPI PAY" value={editBank} onChangeText={setEditBank} keyboardType="numeric" placeholder="Enter amount" autoFocus />
                )}
                {editingField === 'expenses' && (
                  <Input label="Cash Expenses" value={editExpenses} onChangeText={setEditExpenses} keyboardType="numeric" placeholder="Enter amount" autoFocus />
                )}
                <Button
                  title={updatingCash ? "Saving..." : "Save"}
                  onPress={handleUpdateCash}
                  loading={updatingCash}
                  fullWidth
                  size="lg"
                  style={{ marginTop: 16 }}
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
  scroll: { 
    paddingHorizontal: 24, 
    paddingTop: 20, 
    paddingBottom: 40, 
    gap: 16 
  },
  
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  restaurantName: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  calendarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  calendarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F97316',
  },

  cashGrid: {
    gap: 12,
  },
  cashRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cashCard: {
    flex: 1,
    padding: 12,
    alignItems: 'flex-start',
    gap: 12,
  },
  cashIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 4,
  },
  cashValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },

  sectionHeader: {
    marginTop: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },

  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },

  profitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  profitInfo: {
    flex: 1,
  },
  profitValue: {
    fontSize: 28,
    fontWeight: '800',
  },

  modal: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  modalContent: { padding: 20 },
});
