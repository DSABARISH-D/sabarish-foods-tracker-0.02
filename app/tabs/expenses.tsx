import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useExpensesStore } from '@/store';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ChickenCalculator } from '@/components/expenses/ChickenCalculator';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { SHADOW } from '@/constants/theme';
import { useTranslation } from '@/hooks/useTranslation';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ExpenseCategory, ExpenseForm } from '@/types';
import { getTodayDate, formatCurrency } from '@/lib/utils';
import { Ionicons } from '@expo/vector-icons';

const CATEGORIES: { key: ExpenseCategory; icon: any }[] = [
  { key: 'chicken_cost', icon: 'fast-food-outline' },
  { key: 'store_purchases', icon: 'cart-outline' },
  { key: 'market_purchases', icon: 'basket-outline' },
  { key: 'indian_market', icon: 'leaf-outline' },
  { key: 'electricity', icon: 'flash-outline' },
  { key: 'gas_cylinder', icon: 'flame-outline' },
  { key: 'staff_salary', icon: 'people-outline' },
  { key: 'transport', icon: 'car-outline' },
  { key: 'other', icon: 'cube-outline' },
];

export default function ExpensesScreen() {
  const { expenses, expensesLoading, isDayLocked, loadExpenses, checkDayLocked, addExpense, removeExpense, lockDay } =
    useExpensesStore();
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);

  // Form state
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory>('chicken_cost');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [amountError, setAmountError] = useState('');
  const [saving, setSaving] = useState(false);

  // Chicken calculator
  const [chickenKg, setChickenKg] = useState(0);
  const [chickenPricePerKg, setChickenPricePerKg] = useState(0);

  // Gas Cylinder specific date
  const [gasDate, setGasDate] = useState(new Date());
  const [showGasPicker, setShowGasPicker] = useState(false);

  const today = getTodayDate();

  const load = useCallback(async () => {
    await Promise.all([loadExpenses(today), checkDayLocked(today)]);
  }, [today]);

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const todayTotal = expenses.reduce((s, e) => s + e.amount, 0);

  const handleChickenCalc = (total: number, kg: number, price: number) => {
    setAmount(total > 0 ? total.toFixed(2) : '');
    setChickenKg(kg);
    setChickenPricePerKg(price);
  };

  const handleSave = async () => {
    setAmountError('');
    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      setAmountError(t('errors.invalid_amount'));
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);
    try {
      const form: ExpenseForm = {
        category: selectedCategory,
        amount: amountNum,
        description: description.trim() || undefined,
        date: selectedCategory === 'gas_cylinder' ? gasDate.toISOString().split('T')[0] : today,
        ...(selectedCategory === 'chicken_cost' && {
          chicken_kg: chickenKg || undefined,
          chicken_price_per_kg: chickenPricePerKg || undefined,
        }),
      };
      await addExpense(form);
      setAmount('');
      setDescription('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert(t('common.error'), t('errors.unknown'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      t('expenses.confirm_delete'),
      t('expenses.delete_message'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => removeExpense(id) },
      ]
    );
  };

  const handleLockDay = () => {
    Alert.alert(
      t('expenses.lock_day'),
      `${t('expenses.lock_day')}?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.yes'),
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await lockDay(today);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Expenses</Text>
              <Text style={styles.headerSubtitle}>Manage today's expenses</Text>
            </View>
            <View style={styles.totalBadge}>
              <Text style={styles.totalAmount}>{formatCurrency(todayTotal)}</Text>
            </View>
          </View>
          
          {isDayLocked && (
            <View style={styles.lockedBanner}>
              <Ionicons name="lock-closed" size={16} color="#0F172A" />
              <Text style={styles.lockedText}>Day Locked</Text>
            </View>
          )}

          {/* Category Picker */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
            <View style={styles.catRow}>
              {CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat.key;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    onPress={() => {
                      setSelectedCategory(cat.key);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={[
                      styles.catChip,
                      {
                        backgroundColor: isActive ? '#0F172A' : '#FFF',
                        borderColor: isActive ? '#0F172A' : '#E2E8F0',
                      },
                    ]}
                  >
                    <Ionicons name={cat.icon} size={16} color={isActive ? '#FFF' : '#64748B'} />
                    <Text
                      style={[
                        styles.catLabel,
                        { color: isActive ? '#FFF' : '#475569' },
                      ]}
                      numberOfLines={1}
                    >
                      {t(`expenses.categories.${cat.key}`) || cat.key}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Chicken Calculator */}
          {selectedCategory === 'chicken_cost' && (
            <ChickenCalculator onTotalChange={handleChickenCalc} />
          )}

          {/* Form */}
          {!isDayLocked && (
            <View style={[styles.formCard, SHADOW.sm]}>
              <Input
                label={t('expenses.amount')}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                prefix="₹"
                placeholder="0.00"
                error={amountError}
                required
              />

              {selectedCategory === 'gas_cylinder' && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={styles.inputLabel}>
                    {t('expenses.date')}
                  </Text>
                  <TouchableOpacity
                    style={styles.datePickerBtn}
                    onPress={() => setShowGasPicker(true)}
                  >
                    <Text style={styles.datePickerText}>
                      {gasDate.toISOString().split('T')[0]}
                    </Text>
                    <Ionicons name="calendar-outline" size={20} color="#64748B" />
                  </TouchableOpacity>
                  {showGasPicker && (
                    <DateTimePicker
                      value={gasDate}
                      mode="date"
                      display="default"
                      onChange={(event, date) => {
                        setShowGasPicker(false);
                        if (date) setGasDate(date);
                      }}
                    />
                  )}
                </View>
              )}

              {!['chicken_cost', 'store_purchases', 'market_purchases', 'indian_market'].includes(selectedCategory) && (
                <Input
                  label={t('expenses.description')}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Optional description..."
                  multiline
                  numberOfLines={2}
                />
              )}
              <Button
                title={saving ? t('common.loading') : t('expenses.save')}
                onPress={handleSave}
                loading={saving}
                fullWidth
                style={{ marginTop: 8 }}
              />
            </View>
          )}

          {/* Lock Day Button */}
          {!isDayLocked && expenses.length > 0 && (
            <TouchableOpacity
              style={[styles.lockBtn, SHADOW.sm]}
              onPress={handleLockDay}
              activeOpacity={0.8}
            >
              <Ionicons name="lock-closed" size={20} color="#FFF" />
              <Text style={styles.lockBtnText}>{t('expenses.lock_day')}</Text>
            </TouchableOpacity>
          )}

          {/* Expense List */}
          <Text style={styles.sectionLabel}>
            Today's Expenses ({expenses.length})
          </Text>

          {expensesLoading && expenses.length === 0 ? (
            <ListSkeleton count={4} />
          ) : expenses.length === 0 ? (
            <EmptyState emoji="📋" title={t('expenses.empty')} />
          ) : (
            <View style={styles.list}>
              {expenses.map((expense) => (
                <View
                  key={expense.id}
                  style={[styles.expenseRow, SHADOW.sm]}
                >
                  <View style={styles.expenseIcon}>
                    <Ionicons 
                      name={CATEGORIES.find(c => c.key === expense.category)?.icon || "receipt-outline"} 
                      size={20} 
                      color="#64748B" 
                    />
                  </View>
                  <View style={styles.expenseInfo}>
                    <Text style={styles.expenseName}>
                      {t(`expenses.categories.${expense.category}`)}
                    </Text>
                    {expense.description ? (
                      <Text style={styles.expenseDesc}>
                        {expense.description}
                      </Text>
                    ) : null}
                    {expense.locked && (
                      <Text style={styles.lockedTag}><Ionicons name="lock-closed" size={10} /> {t('expenses.locked')}</Text>
                    )}
                  </View>
                  <View style={styles.expenseRight}>
                    <Text style={styles.expenseAmount}>
                      {formatCurrency(expense.amount)}
                    </Text>
                    {!expense.locked && (
                      <TouchableOpacity onPress={() => handleDelete(expense.id)} style={{ padding: 4 }}>
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
  scroll: { paddingBottom: 40 },
  
  lockBtn: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 8,
    gap: 8,
  },
  lockBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 10,
  },
  headerTitle: {
    color: '#0F172A',
    fontSize: 28,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  totalBadge: {
    backgroundColor: '#DBEAFE',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  totalAmount: {
    color: '#3B82F6',
    fontSize: 18,
    fontWeight: '800',
  },
  
  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 12,
    justifyContent: 'center',
  },
  lockedText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '600',
  },

  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  
  catScroll: { paddingHorizontal: 20 },
  catRow: { flexDirection: 'row', gap: 8, paddingRight: 40, paddingBottom: 8 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  catLabel: { fontSize: 13, fontWeight: '600' },
  
  formCard: {
    margin: 20,
    borderRadius: 20,
    padding: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  datePickerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  datePickerText: { color: '#0F172A', fontSize: 15, fontWeight: '500' },

  list: { paddingHorizontal: 20, gap: 12 },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  expenseIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseInfo: { flex: 1 },
  expenseName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  expenseDesc: { 
    fontSize: 13, 
    color: '#64748B', 
    marginTop: 2 
  },
  lockedTag: {
    fontSize: 11,
    color: '#F59E0B',
    marginTop: 4,
    fontWeight: '600'
  },
  expenseRight: { 
    alignItems: 'flex-end', 
    justifyContent: 'center',
    gap: 6 
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
});
