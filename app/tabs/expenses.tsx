import React, { useEffect, useState, useCallback, useRef } from 'react';
import { router } from 'expo-router';
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
  TextInput,
  Animated,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useExpensesStore, useAuthStore, useInventoryStore } from '@/store';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ChickenCalculator } from '@/components/expenses/ChickenCalculator';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { SHADOW } from '@/constants/theme';
import { useTranslation } from '@/hooks/useTranslation';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ExpenseCategory, ExpenseForm } from '@/types';
import { getTodayDate, formatCurrency, getLocalDateString } from '@/lib/utils';
import { Ionicons } from '@expo/vector-icons';

// ── Constants ───────────────────────────────────────────────────────
const CATEGORIES: { key: any; icon: any; label: string }[] = [
  { key: 'chicken_cost',     icon: 'fast-food-outline',  label: 'Chicken Cost'      },
  { key: 'store_purchases',  icon: 'cart-outline',        label: 'Store Purchases'   },
  { key: 'market_purchases', icon: 'basket-outline',      label: 'Market Purchases'  },
  { key: 'indian_market',    icon: 'leaf-outline',        label: 'Indian Market'     },
  { key: 'electricity',      icon: 'flash-outline',       label: 'Electricity'       },
  { key: 'gas_cylinder',     icon: 'flame-outline',       label: 'Gas'               },
  { key: 'staff',            icon: 'people-outline',      label: 'Staff'             },
  { key: 'credit_kadan',     icon: 'wallet-outline',      label: 'Credit Kadan'      },
  { key: 'transport',        icon: 'car-outline',         label: 'Transport'         },
  { key: 'other',            icon: 'cube-outline',        label: 'Other'             },
];

// Store Purchases – quick suggestion items
const STORE_QUICK_ITEMS = [
  'Eggs', 'Cooking Oil', 'Rice', 'Paper Cups', 'Parcel Covers',
  'Plastic Covers', 'Tissue Paper', 'Rubber Bands', 'Match Box',
  'Plastic Spoons', 'Carry Bags',
];

// ── Types ────────────────────────────────────────────────────────────
interface PurchaseItem {
  id: string;
  name: string;
  quantity: string;
  price: string;
  paymentStatus?: 'Paid' | 'Pending';
}

// ── Helpers ──────────────────────────────────────────────────────────
function newItem(): PurchaseItem {
  return { id: Date.now().toString() + Math.random().toString(36).slice(2), name: '', quantity: '', price: '', paymentStatus: 'Paid' };
}

function itemTotal(item: PurchaseItem): number {
  const q = parseFloat(item.quantity) || 0;
  const p = parseFloat(item.price) || 0;
  return q * p;
}

function grandTotal(items: PurchaseItem[]): number {
  return items.reduce((s, i) => s + itemTotal(i), 0);
}

// ── Store Purchases Form ─────────────────────────────────────────────
interface StorePurchasesFormProps {
  onSave: (total: number, description: string, items: PurchaseItem[]) => void;
  saving: boolean;
}

function StorePurchasesForm({ onSave, saving }: StorePurchasesFormProps) {
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [activeItem, setActiveItem] = useState<PurchaseItem>({ id: 'active', name: '', quantity: '', price: '', paymentStatus: 'Paid' });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const nameInputRef = useRef<TextInput>(null);

  const handleActiveChange = (field: keyof PurchaseItem, value: string) => {
    setValidationError(null);
    setActiveItem((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddItem = useCallback(() => {
    const name = activeItem.name.trim();
    const quantity = activeItem.quantity.trim();
    const price = activeItem.price.trim();

    if (!name && (quantity || price)) {
      setValidationError("Please enter the item name.");
      return;
    }
    if (name && !quantity) {
      setValidationError("Please enter the quantity.");
      return;
    }
    if (name && quantity && !price) {
      setValidationError("Please enter the price.");
      return;
    }
    if (!name || !quantity || !price) {
      setValidationError("Please enter the item name, quantity and price.");
      return;
    }

    setValidationError(null);
    

    const added: PurchaseItem = {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      name,
      quantity,
      price,
      paymentStatus: name.toLowerCase().trim() === 'rice' ? activeItem.paymentStatus || 'Paid' : 'Paid',
    };

    setItems((prev) => [...prev, added]);

    // Reset active fields
    setActiveItem({ id: 'active', name: '', quantity: '', price: '', paymentStatus: 'Paid' });

    // Focus Item Name input for next item
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 100);
  }, [activeItem]);

  const handleTableChange = useCallback((id: string, field: keyof PurchaseItem, value: string) => {
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, [field]: value } : it));
  }, []);

  const handleTableDelete = useCallback((id: string) => {
    
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const total = grandTotal(items);

  const handleSave = () => {
    const validItems = items.filter((i) => i.name.trim() && (parseFloat(i.quantity) || 0) > 0 && (parseFloat(i.price) || 0) > 0);
    if (validItems.length === 0) {
      setValidationError("Please add at least one item to the list before saving.");
      return;
    }

    const description = validItems
      .map((i) => `${i.name}\n${i.quantity} × ₹${i.price}`)
      .join('\n') + `\nTotal\n₹${total.toFixed(0)}`;

    onSave(total, description, validItems);
    setItems([]); // Clear list after save
  };

  const getSuggestions = (name: string): string[] => {
    const q = name.toLowerCase().trim();
    if (!q) return STORE_QUICK_ITEMS;
    return STORE_QUICK_ITEMS.filter((s) => s.toLowerCase().includes(q) && s.toLowerCase() !== q);
  };

  return (
    <View>
      {/* Active Form Card */}
      <View style={styles.itemCard}>
        <View style={styles.itemHeader}>
          <Text style={styles.storePurchasesTitle}>New Purchase Item</Text>
          {validationError && (
            <Text style={styles.validationErrorText}>{validationError}</Text>
          )}
        </View>

        {/* Item Name Input with horizontal suggestions */}
        <View style={{ marginBottom: 10 }}>
          <Text style={styles.fieldLabel}>Item Name</Text>
          <TextInput
            ref={nameInputRef}
            style={styles.fieldInput}
            value={activeItem.name}
            onChangeText={(v) => handleActiveChange('name', v)}
            placeholder="e.g. Eggs, Cooking Oil..."
            placeholderTextColor="#CBD5E1"
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => {
              setTimeout(() => setShowSuggestions(false), 200);
            }}
          />
          {showSuggestions && (
            <View style={styles.suggestionsBox}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always">
                <View style={{ flexDirection: 'row', gap: 8, padding: 8 }}>
                  {getSuggestions(activeItem.name).map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={styles.suggestionChip}
                      onPress={() => {
                        handleActiveChange('name', s);
                        
                      }}
                    >
                      <Text style={styles.suggestionChipText}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}
        </View>

        {/* Qty / Price row */}
        <View style={styles.itemFieldsRow}>
          {/* Quantity */}
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Qty</Text>
            <TextInput
              style={styles.fieldInput}
              value={activeItem.quantity}
              onChangeText={(v) => handleActiveChange('quantity', v)}
              placeholder="0"
              placeholderTextColor="#CBD5E1"
              keyboardType="decimal-pad"
            />
          </View>

          {/* Price */}
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Price (₹)</Text>
            <View style={[styles.fieldInput, { flexDirection: 'row', alignItems: 'center', paddingVertical: 0 }]}>
              <Text style={{ color: '#94A3B8', marginRight: 4, fontSize: 14 }}>₹</Text>
              <TextInput
                style={{ flex: 1, color: '#0F172A', fontSize: 14, fontWeight: '600', paddingVertical: 12 }}
                value={activeItem.price}
                onChangeText={(v) => handleActiveChange('price', v)}
                placeholder="0"
                placeholderTextColor="#CBD5E1"
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </View>

        {/* Payment Status Segmented buttons (Only for Rice) */}
        {activeItem.name.toLowerCase().trim() === 'rice' && (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.fieldLabel}>Payment Status</Text>
            <View style={styles.segmentedContainer}>
              <TouchableOpacity
                style={[
                  styles.segmentedButton,
                  activeItem.paymentStatus !== 'Pending' && styles.segmentedActivePaid,
                ]}
                onPress={() => handleActiveChange('paymentStatus', 'Paid')}
              >
                <Ionicons name="checkmark-circle" size={16} color={activeItem.paymentStatus !== 'Pending' ? '#FFF' : '#64748B'} />
                <Text style={[styles.segmentedText, activeItem.paymentStatus !== 'Pending' && styles.segmentedTextActive]}>Paid</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.segmentedButton,
                  activeItem.paymentStatus === 'Pending' && styles.segmentedActivePending,
                ]}
                onPress={() => handleActiveChange('paymentStatus', 'Pending')}
              >
                <Ionicons name="time" size={16} color={activeItem.paymentStatus === 'Pending' ? '#FFF' : '#64748B'} />
                <Text style={[styles.segmentedText, activeItem.paymentStatus === 'Pending' && styles.segmentedTextActive]}>Pending</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Add Item Button */}
      <TouchableOpacity style={styles.addItemBtn} onPress={handleAddItem}>
        <Ionicons name="add-circle-outline" size={22} color="#F97316" />
        <Text style={styles.addItemText}>Add Item</Text>
      </TouchableOpacity>

      {/* Purchase List (Editable Table) */}
      {items.length > 0 && (
        <View style={styles.summaryTable}>
          <View style={styles.summaryHeaderRow}>
            <Text style={[styles.summaryCell, { flex: 2.2 }]}>Item</Text>
            <Text style={[styles.summaryCell, styles.summaryCellRight, { flex: 1 }]}>Qty</Text>
            <Text style={[styles.summaryCell, styles.summaryCellRight, { flex: 1.2 }]}>Price</Text>
            <Text style={[styles.summaryCell, styles.summaryCellRight, { flex: 1.2 }]}>Total</Text>
            <View style={{ width: 30 }} />
          </View>
          {items.map((item) => (
            <View key={item.id} style={styles.summaryDataRow}>
              <View style={{ flex: 2.2 }}>
                <TextInput
                  style={[styles.tableInput, { width: '100%' }]}
                  value={item.name}
                  onChangeText={(v) => handleTableChange(item.id, 'name', v)}
                  placeholder="Item"
                />
                {item.name.toLowerCase().trim() === 'rice' && item.paymentStatus === 'Pending' && (
                  <Text style={{ fontSize: 9, color: '#D97706', fontWeight: '800', marginTop: 2, marginLeft: 2 }}>🟡 PENDING</Text>
                )}
              </View>
              <TextInput
                style={[styles.tableInput, styles.summaryCellRight, { flex: 1, marginLeft: 6 }]}
                value={item.quantity}
                onChangeText={(v) => handleTableChange(item.id, 'quantity', v)}
                keyboardType="decimal-pad"
                placeholder="0"
              />
              <TextInput
                style={[styles.tableInput, styles.summaryCellRight, { flex: 1.2, marginLeft: 6 }]}
                value={item.price}
                onChangeText={(v) => handleTableChange(item.id, 'price', v)}
                keyboardType="decimal-pad"
                placeholder="0"
              />
              <Text style={[styles.summaryCellData, styles.summaryCellRight, { flex: 1.2, fontWeight: '700', color: '#0F172A', alignSelf: 'center' }]}>
                ₹{itemTotal(item).toFixed(0)}
              </Text>
              <TouchableOpacity
                onPress={() => handleTableDelete(item.id)}
                style={{ width: 30, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Total Amount Card */}
      <View style={styles.subtotalCard}>
        <View style={styles.subtotalRow}>
          <Text style={styles.subtotalLabel}>Total Amount</Text>
          <Text style={styles.subtotalAmount}>₹{total.toFixed(2)}</Text>
        </View>
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveBtn, (saving || total === 0) && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving || total === 0}
      >
        {saving ? (
          <Text style={styles.saveBtnText}>Saving...</Text>
        ) : (
          <>
            <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" />
            <Text style={styles.saveBtnText}>Save Expense  ₹{total.toFixed(0)}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ── Market Purchases Form ────────────────────────────────────────────
const MARKET_QUICK_ITEMS = [
  'Beans', 'Carrot', 'Capsicum', 'Cabbage', 'Onion', 'Tomato',
  'Potato', 'Brinjal', 'Drumstick', 'Green Chilli', 'Coriander Leaves',
  'Curry Leaves', 'Mint Leaves', 'Spinach', 'Cauliflower', 'Beetroot',
  'Radish', 'Lemon', 'Ginger', 'Garlic'
];

interface MarketPurchasesFormProps {
  onSave: (total: number, description: string) => void;
  saving: boolean;
}

function MarketPurchasesForm({ onSave, saving }: MarketPurchasesFormProps) {
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [activeItem, setActiveItem] = useState<PurchaseItem>({ id: 'active', name: '', quantity: '', price: '' });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const nameInputRef = useRef<TextInput>(null);

  const handleActiveChange = (field: keyof PurchaseItem, value: string) => {
    setValidationError(null);
    setActiveItem((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddItem = useCallback(() => {
    const name = activeItem.name.trim();
    const quantity = activeItem.quantity.trim();
    const price = activeItem.price.trim();

    if (!name) {
      setValidationError("Please enter the item name.");
      return;
    }
    if (!quantity) {
      setValidationError("Please enter the quantity.");
      return;
    }
    if (!price) {
      setValidationError("Please enter the price.");
      return;
    }

    setValidationError(null);
    

    const added: PurchaseItem = {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      name,
      quantity,
      price,
    };

    setItems((prev) => [...prev, added]);

    // Reset active fields
    setActiveItem({ id: 'active', name: '', quantity: '', price: '' });

    // Focus Item Name input for next item
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 100);
  }, [activeItem]);

  const handleTableChange = useCallback((id: string, field: keyof PurchaseItem, value: string) => {
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, [field]: value } : it));
  }, []);

  const handleTableDelete = useCallback((id: string) => {
    
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const total = grandTotal(items);

  const handleSave = () => {
    const validItems = items.filter((i) => i.name.trim() && (parseFloat(i.quantity) || 0) > 0 && (parseFloat(i.price) || 0) > 0);
    if (validItems.length === 0) {
      setValidationError("Please add at least one item to the list before saving.");
      return;
    }

    const description = validItems
      .map((i) => `${i.name}\n${i.quantity} × ₹${i.price}`)
      .join('\n') + `\nTotal\n₹${total.toFixed(0)}`;

    onSave(total, description);
    setItems([]); // Clear list after save
  };

  const getSuggestions = (name: string): string[] => {
    const q = name.toLowerCase().trim();
    if (!q) return MARKET_QUICK_ITEMS;
    return MARKET_QUICK_ITEMS.filter((s) => s.toLowerCase().includes(q) && s.toLowerCase() !== q);
  };

  return (
    <View>
      {/* Active Form Card */}
      <View style={styles.itemCard}>
        <View style={styles.itemHeader}>
          <Text style={styles.storePurchasesTitle}>New Market Item</Text>
          {validationError && (
            <Text style={styles.validationErrorText}>{validationError}</Text>
          )}
        </View>

        {/* Item Name Input with horizontal suggestions */}
        <View style={{ marginBottom: 10 }}>
          <Text style={styles.fieldLabel}>Item Name</Text>
          <TextInput
            ref={nameInputRef}
            style={styles.fieldInput}
            value={activeItem.name}
            onChangeText={(v) => handleActiveChange('name', v)}
            placeholder="e.g. Beans, Carrot..."
            placeholderTextColor="#CBD5E1"
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => {
              setTimeout(() => setShowSuggestions(false), 200);
            }}
          />
          {showSuggestions && (
            <View style={styles.suggestionsBox}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always">
                <View style={{ flexDirection: 'row', gap: 8, padding: 8 }}>
                  {getSuggestions(activeItem.name).map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={styles.suggestionChip}
                      onPress={() => {
                        handleActiveChange('name', s);
                        
                      }}
                    >
                      <Text style={styles.suggestionChipText}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}
        </View>

        {/* Qty / Price row */}
        <View style={styles.itemFieldsRow}>
          {/* Quantity */}
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Qty</Text>
            <TextInput
              style={styles.fieldInput}
              value={activeItem.quantity}
              onChangeText={(v) => handleActiveChange('quantity', v)}
              placeholder="0"
              placeholderTextColor="#CBD5E1"
              keyboardType="decimal-pad"
            />
          </View>

          {/* Price */}
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Price (₹)</Text>
            <View style={[styles.fieldInput, { flexDirection: 'row', alignItems: 'center', paddingVertical: 0 }]}>
              <Text style={{ color: '#94A3B8', marginRight: 4, fontSize: 14 }}>₹</Text>
              <TextInput
                style={{ flex: 1, color: '#0F172A', fontSize: 14, fontWeight: '600', paddingVertical: 12 }}
                value={activeItem.price}
                onChangeText={(v) => handleActiveChange('price', v)}
                placeholder="0"
                placeholderTextColor="#CBD5E1"
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </View>
      </View>

      {/* Add Item Button */}
      <TouchableOpacity style={styles.addItemBtn} onPress={handleAddItem}>
        <Ionicons name="add-circle-outline" size={22} color="#F97316" />
        <Text style={styles.addItemText}>Add Item</Text>
      </TouchableOpacity>

      {/* Purchase List (Editable Table) */}
      {items.length > 0 && (
        <View style={styles.summaryTable}>
          <View style={styles.summaryHeaderRow}>
            <Text style={[styles.summaryCell, { flex: 2.2 }]}>Item</Text>
            <Text style={[styles.summaryCell, styles.summaryCellRight, { flex: 1 }]}>Qty</Text>
            <Text style={[styles.summaryCell, styles.summaryCellRight, { flex: 1.2 }]}>Price</Text>
            <Text style={[styles.summaryCell, styles.summaryCellRight, { flex: 1.2 }]}>Total</Text>
            <View style={{ width: 30 }} />
          </View>
          {items.map((item) => (
            <View key={item.id} style={styles.summaryDataRow}>
              <TextInput
                style={[styles.tableInput, { flex: 2.2 }]}
                value={item.name}
                onChangeText={(v) => handleTableChange(item.id, 'name', v)}
                placeholder="Item"
              />
              <TextInput
                style={[styles.tableInput, styles.summaryCellRight, { flex: 1, marginLeft: 6 }]}
                value={item.quantity}
                onChangeText={(v) => handleTableChange(item.id, 'quantity', v)}
                keyboardType="decimal-pad"
                placeholder="0"
              />
              <TextInput
                style={[styles.tableInput, styles.summaryCellRight, { flex: 1.2, marginLeft: 6 }]}
                value={item.price}
                onChangeText={(v) => handleTableChange(item.id, 'price', v)}
                keyboardType="decimal-pad"
                placeholder="0"
              />
              <Text style={[styles.summaryCellData, styles.summaryCellRight, { flex: 1.2, fontWeight: '700', color: '#0F172A', alignSelf: 'center' }]}>
                ₹{itemTotal(item).toFixed(0)}
              </Text>
              <TouchableOpacity
                onPress={() => handleTableDelete(item.id)}
                style={{ width: 30, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Total Amount Card */}
      <View style={styles.marketTotalCard}>
        <View style={styles.subtotalRow}>
          <Text style={styles.marketTotalLabel}>Total Amount</Text>
          <Text style={styles.marketTotalAmount}>₹{total.toFixed(2)}</Text>
        </View>
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveBtn, (saving || total === 0) && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving || total === 0}
      >
        {saving ? (
          <Text style={styles.saveBtnText}>Saving...</Text>
        ) : (
          <>
            <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" />
            <Text style={styles.saveBtnText}>Save Expense  ₹{total.toFixed(0)}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────
export default function ExpensesScreen() {
  const { expenses, expensesLoading, isDayLocked, loadExpenses, checkDayLocked, addExpense, removeExpense, lockDay, markExpensePaid } =
    useExpensesStore();
  const { activeStaff, activePermissions } = useAuthStore();
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

  // Generic save (for non store_purchases categories)
  const handleSave = async () => {
    setAmountError('');
    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      setAmountError(t('errors.invalid_amount'));
      return;
    }
    
    setSaving(true);
    try {
      const form: ExpenseForm = {
        category: selectedCategory,
        amount: amountNum,
        description: description.trim() || undefined,
        date: selectedCategory === 'gas_cylinder' ? getLocalDateString(gasDate) : today,
        ...(selectedCategory === 'chicken_cost' && {
          chicken_kg: chickenKg || undefined,
          chicken_price_per_kg: chickenPricePerKg || undefined,
        }),
        payment_status: 'Paid',
      };
      await addExpense(form);
      setAmount('');
      setDescription('');
      
    } catch (err) {
      Alert.alert(t('common.error'), t('errors.unknown'));
    } finally {
      setSaving(false);
    }
  };

  // Store purchases save (item-based)
  const handleStoreSave = async (total: number, desc: string, validItems: PurchaseItem[]) => {
    if (total <= 0) return;
    
    setSaving(true);
    try {
      // Find if there is a pending Rice item
      const pendingRiceItem = validItems.find(
        (i) => i.name.toLowerCase().trim() === 'rice' && i.paymentStatus === 'Pending'
      );
      
      if (pendingRiceItem) {
        const riceQty = parseFloat(pendingRiceItem.quantity) || 0;
        const ricePrice = parseFloat(pendingRiceItem.price) || 0;
        const riceTotal = riceQty * ricePrice;
        
        // 1. Save Rice Pending as its own expense
        const riceForm: ExpenseForm = {
          category: 'store_purchases',
          amount: riceTotal,
          description: `Rice\n${pendingRiceItem.quantity} × ₹${pendingRiceItem.price}\nTotal\n₹${riceTotal.toFixed(0)}`,
          date: today,
          payment_status: 'Pending',
        };
        await addExpense(riceForm, [pendingRiceItem]);

        // 2. Save all other items as a separate paid store purchase expense (if any exist)
        const otherItems = validItems.filter((i) => i.id !== pendingRiceItem.id);
        if (otherItems.length > 0) {
          const otherTotal = otherItems.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0) * (parseFloat(i.price) || 0), 0);
          const otherDesc = otherItems
            .map((i) => `${i.name}\n${i.quantity} × ₹${i.price}`)
            .join('\n') + `\nTotal\n₹${otherTotal.toFixed(0)}`;
            
          const otherForm: ExpenseForm = {
            category: 'store_purchases',
            amount: otherTotal,
            description: otherDesc,
            date: today,
            payment_status: 'Paid',
          };
          await addExpense(otherForm, otherItems);
        }
      } else {
        // Normal save (either no Rice, or Rice is Paid)
        const form: ExpenseForm = {
          category: 'store_purchases',
          amount: total,
          description: desc,
          date: today,
          payment_status: 'Paid',
        };
        await addExpense(form, validItems);
      }
      
      
      // Reload inventory state in the background immediately
      useInventoryStore.getState().loadInventory().catch(() => {});
    } catch (err) {
      console.error('Failed to save store purchase silently:', err);
    } finally {
      setSaving(false);
    }
  };

  // Market purchases save (item-based)
  const handleMarketSave = async (total: number, desc: string) => {
    if (total <= 0) return;
    
    setSaving(true);
    try {
      const form: ExpenseForm = {
        category: 'market_purchases',
        amount: total,
        description: desc,
        date: today,
        payment_status: 'Paid',
      };
      await addExpense(form);
      
    } catch (err) {
      console.error('Failed to save market purchase:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    
    removeExpense(id).catch(() => {});
  };

  const isStorePurchases = selectedCategory === 'store_purchases';
  const isMarketPurchases = selectedCategory === 'market_purchases';

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
          {/* ── Header ── */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Expenses</Text>
              <Text style={styles.headerSubtitle}>Manage today's expenses</Text>
            </View>
            <View style={styles.totalBadge}>
              <Text style={styles.totalBadgeLabel}>Today</Text>
              <Text style={styles.totalAmount}>{formatCurrency(todayTotal)}</Text>
            </View>
          </View>

          {/* ── Category Picker ── */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
            <View style={styles.catRow}>
              {CATEGORIES.map((cat) => {
                if (activeStaff) {
                  if (cat.key === 'staff') return null;
                  if (cat.key === 'credit_kadan' && !activePermissions?.credit) return null;
                }
                const isActive = selectedCategory === cat.key;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    onPress={() => {
                      if (cat.key === 'staff') {  router.push('/tabs/staff'); return; }
                      if (cat.key === 'credit_kadan') {  router.push('/kadan'); return; }
                      setSelectedCategory(cat.key);
                      setAmount('');
                      setAmountError('');
                      
                    }}
                    style={[styles.catChip, { backgroundColor: isActive ? '#0F172A' : '#FFF', borderColor: isActive ? '#0F172A' : '#E2E8F0' }]}
                  >
                    <Ionicons name={cat.icon} size={15} color={isActive ? '#FFF' : '#64748B'} />
                    <Text style={[styles.catLabel, { color: isActive ? '#FFF' : '#475569' }]} numberOfLines={1}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* ── Store Purchases: Item-Based Form ── */}
          {isStorePurchases ? (
            <View style={styles.storePurchasesContainer}>
              {/* Section header */}
              <View style={styles.storePurchasesHeader}>
                <View style={styles.storePurchasesIconBox}>
                  <Ionicons name="cart" size={20} color="#F97316" />
                </View>
                <View>
                  <Text style={styles.storePurchasesTitle}>Store Purchases</Text>
                  <Text style={styles.storePurchasesSubtitle}>Add items purchased from store</Text>
                </View>
              </View>

              <StorePurchasesForm onSave={handleStoreSave} saving={saving} />
            </View>
          ) : isMarketPurchases ? (
            <View style={styles.storePurchasesContainer}>
              {/* Section header */}
              <View style={[styles.storePurchasesHeader, { borderColor: '#FDBA74', backgroundColor: '#FFF7ED' }]}>
                <View style={[styles.storePurchasesIconBox, { backgroundColor: '#FFF7ED' }]}>
                  <Ionicons name="basket" size={20} color="#F97316" />
                </View>
                <View>
                  <Text style={styles.storePurchasesTitle}>Market Purchases</Text>
                  <Text style={styles.storePurchasesSubtitle}>Add items purchased from market</Text>
                </View>
              </View>

              <MarketPurchasesForm onSave={handleMarketSave} saving={saving} />
            </View>
          ) : (
            <>
              {/* ── Chicken Calculator ── */}
              {selectedCategory === 'chicken_cost' && (
                <ChickenCalculator onTotalChange={handleChickenCalc} />
              )}

              {/* ── Generic Form Card ── */}
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
                    <Text style={styles.inputLabel}>{t('expenses.date')}</Text>
                    <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowGasPicker(true)}>
                      <Text style={styles.datePickerText}>{getLocalDateString(gasDate)}</Text>
                      <Ionicons name="calendar-outline" size={20} color="#64748B" />
                    </TouchableOpacity>
                    {showGasPicker && (
                      <DateTimePicker
                        value={gasDate}
                        mode="date"
                        display="default"
                        onChange={(event, date) => { setShowGasPicker(false); if (date) setGasDate(date); }}
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
            </>
          )}

          {/* ── Expense List ── */}
          <View style={styles.listHeader}>
            <Text style={styles.sectionLabel}>Today's Expenses</Text>
            <View style={styles.expenseCountBadge}>
              <Text style={styles.expenseCountText}>{expenses.length}</Text>
            </View>
          </View>

          {expensesLoading && expenses.length === 0 ? (
            <ListSkeleton count={4} />
          ) : expenses.length === 0 ? (
            <EmptyState emoji="📋" title={t('expenses.empty')} />
          ) : (
            <View style={styles.list}>
              {expenses.map((expense) => {
                const catDef = CATEGORIES.find((c) => c.key === expense.category);
                const isPending = expense.payment_status === 'Pending';
                const isOwner = !activeStaff;
                const isRice = expense.description?.toLowerCase().includes('rice');

                const handleExpensePress = () => {
                  if (isPending && isOwner) {
                    Alert.alert(
                      "Pending Payment",
                      `Mark "${expense.description?.split('\n')[0] || expense.category}" as Paid?`,
                      [
                        { text: "Cancel", style: "cancel" },
                        { 
                          text: "Mark as Paid", 
                          onPress: async () => {
                            try {
                              await markExpensePaid(expense.id);
                              
                            } catch (err: any) {
                              Alert.alert("Error", err.message || "Failed to update payment status.");
                            }
                          }
                        }
                      ]
                    );
                  }
                };

                return (
                  <TouchableOpacity
                    key={expense.id}
                    activeOpacity={isPending && isOwner ? 0.7 : 1}
                    onPress={handleExpensePress}
                    disabled={!(isPending && isOwner)}
                    style={[styles.expenseRow, SHADOW.sm]}
                  >
                    <View style={[styles.expenseIcon, { backgroundColor: expense.category === 'store_purchases' ? '#FFF7ED' : '#F1F5F9' }]}>
                      <Ionicons
                        name={catDef?.icon || 'receipt-outline'}
                        size={20}
                        color={expense.category === 'store_purchases' ? '#F97316' : '#64748B'}
                      />
                    </View>
                    <View style={styles.expenseInfo}>
                      <Text style={styles.expenseName}>{catDef?.label || expense.category}</Text>
                      {expense.description ? (
                        <Text style={styles.expenseDesc} numberOfLines={2}>{expense.description}</Text>
                      ) : null}
                      {expense.payment_status && (isRice || isPending) && (
                        <View style={[
                          styles.statusBadgeSmall,
                          { backgroundColor: isPending ? '#FEF3C7' : '#DCFCE7', marginTop: 6 }
                        ]}>
                          <Text style={[
                            styles.statusBadgeTextSmall,
                            { color: isPending ? '#D97706' : '#15803D' }
                          ]}>
                            {isPending ? '🟡 Pending' : '🟢 Paid'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.expenseRight}>
                      <Text style={styles.expenseAmount}>{formatCurrency(expense.amount)}</Text>
                      <TouchableOpacity onPress={() => handleDelete(expense.id)} style={{ padding: 4 }}>
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
  scroll: { paddingBottom: 40 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  headerTitle: { color: '#0F172A', fontSize: 28, fontWeight: '800' },
  headerSubtitle: { color: '#64748B', fontSize: 13, fontWeight: '500', marginTop: 2 },
  totalBadge: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  totalBadgeLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '600', letterSpacing: 0.5, marginBottom: 2 },
  totalAmount: { color: '#FFF', fontSize: 17, fontWeight: '800' },

  // Category pills
  catScroll: { paddingLeft: 20 },
  catRow: { flexDirection: 'row', gap: 8, paddingRight: 40, paddingBottom: 12 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
  },
  catLabel: { fontSize: 12, fontWeight: '600' },

  // Generic Form Card
  formCard: {
    marginHorizontal: 20,
    marginTop: 4,
    borderRadius: 20,
    padding: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 8 },
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

  // Validation, suggestions, and table styles
  validationErrorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
    flex: 1,
    textAlign: 'right',
  },
  tableInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  suggestionsBox: {
    marginTop: 6,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  suggestionChip: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  suggestionChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },

  // Store Purchases Container
  storePurchasesContainer: {
    marginHorizontal: 16,
    marginTop: 4,
  },
  storePurchasesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  storePurchasesIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storePurchasesTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  storePurchasesSubtitle: { fontSize: 12, color: '#64748B', marginTop: 1 },

  // Item Card
  itemCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  itemIndex: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIndexText: { fontSize: 12, fontWeight: '800', color: '#475569' },
  itemTotal: { flex: 1, fontSize: 15, fontWeight: '800', color: '#F97316', textAlign: 'right' },
  itemDeleteBtn: { padding: 2 },

  // Fields
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', marginBottom: 5, letterSpacing: 0.3, textTransform: 'uppercase' },
  fieldInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  itemFieldsRow: { flexDirection: 'row', gap: 8 },
  // Add Item Button
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FED7AA',
    borderStyle: 'dashed',
    backgroundColor: '#FFF7ED',
  },
  addItemText: { fontSize: 15, fontWeight: '700', color: '#F97316' },

  // Subtotal
  subtotalCard: {
    marginTop: 16,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 18,
  },
  subtotalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subtotalLabel: { fontSize: 14, fontWeight: '700', color: '#94A3B8' },
  subtotalHint: { fontSize: 12, color: '#64748B', marginTop: 2 },
  subtotalAmount: { fontSize: 28, fontWeight: '900', color: '#FFF' },

  // Summary Table
  summaryTable: {
    marginTop: 14,
    backgroundColor: '#FFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  summaryDataRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  summaryCell: { fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.3, textTransform: 'uppercase' },
  summaryCellRight: { textAlign: 'right' },
  summaryCellData: { fontSize: 13, color: '#475569', fontWeight: '500' },

  // Save Button
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    backgroundColor: '#F97316',
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#FFF' },

  // Expense List
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 28,
    marginBottom: 12,
  },
  sectionLabel: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  expenseCountBadge: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  expenseCountText: { fontSize: 12, fontWeight: '700', color: '#FFF' },

  list: { paddingHorizontal: 16, gap: 10 },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  expenseIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseInfo: { flex: 1 },
  expenseName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  expenseDesc: { fontSize: 12, color: '#64748B', marginTop: 2, lineHeight: 16 },
  expenseRight: { alignItems: 'flex-end', justifyContent: 'center', gap: 6 },
  expenseAmount: { fontSize: 15, fontWeight: '800', color: '#0F172A' },

  // New styles for Segmented selector and status badges
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginTop: 4,
  },
  segmentedButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  segmentedActivePaid: {
    backgroundColor: '#22C55E',
  },
  segmentedActivePending: {
    backgroundColor: '#F59E0B',
  },
  segmentedText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  segmentedTextActive: {
    color: '#FFF',
  },
  statusBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusBadgeTextSmall: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  marketTotalCard: {
    marginTop: 16,
    backgroundColor: '#EFF6FF', // Light blue
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  marketTotalLabel: { fontSize: 14, fontWeight: '700', color: '#1E40AF' },
  marketTotalAmount: { fontSize: 28, fontWeight: '900', color: '#1D4ED8' },
});
