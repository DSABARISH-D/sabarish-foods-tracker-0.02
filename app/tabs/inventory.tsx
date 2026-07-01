import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInventoryStore, useAuthStore } from '@/store';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { SHADOW } from '@/constants/theme';
import { useTranslation } from '@/hooks/useTranslation';
import { InventoryRecord } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

export default function InventoryScreen() {
  const { user, activeStaff, activePermissions } = useAuthStore();
  const { inventory, inventoryLoading, loadInventory, updateStock } =
    useInventoryStore();
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryRecord | null>(null);
  const [newQty, setNewQty] = useState('');
  const [updating, setUpdating] = useState(false);

  // New Item State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newItemForm, setNewItemForm] = useState({
    itemName: '',
    unit: '',
    currentStock: '',
    minStock: '',
  });

  useEffect(() => { loadInventory(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInventory();
    setRefreshing(false);
  };

  const handleUpdate = async () => {
    if (!selectedItem) return;
    const qty = parseFloat(newQty);
    if (isNaN(qty) || qty < 0) {
      Alert.alert(t('common.error'), 'Enter a valid quantity');
      return;
    }
    setUpdating(true);
    try {
      await updateStock(selectedItem.id, qty);
      
      setSelectedItem(null);
      setNewQty('');
    } finally {
      setUpdating(false);
    }
  };

  const handleCreate = async () => {
    if (!user) return;
    const { itemName, unit, currentStock, minStock } = newItemForm;
    if (!itemName.trim() || !unit.trim() || !currentStock || !minStock) {
      Alert.alert(t('common.error'), 'Please fill in all fields.');
      return;
    }

    const qty = parseFloat(currentStock);
    const min = parseFloat(minStock);

    if (isNaN(qty) || isNaN(min) || qty < 0 || min < 0) {
      Alert.alert(t('common.error'), 'Enter valid numeric values for stock.');
      return;
    }

    setCreating(true);
    try {
      const { error } = await supabase.from('inventory').insert({
        user_id: user.id,
        item_name: itemName.trim(),
        quantity: qty,
        unit: unit.trim(),
        low_stock_threshold: min,
        last_updated: new Date().toISOString(),
      });
      if (error) throw error;
      
      await loadInventory();
      
      Alert.alert('Success', 'Inventory item added successfully.');
      setShowCreateModal(false);
      setNewItemForm({ itemName: '', unit: '', currentStock: '', minStock: '' });
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || 'Failed to add item.');
    } finally {
      setCreating(false);
    }
  };

  const isTrackedItem = (name: string): boolean => {
    const n = name.toLowerCase().trim();
    return ['rice', 'chicken', 'cooking oil', 'masalas', 'gas cylinder', 'oil', 'masala', 'gas'].includes(n);
  };

  const getItemUnit = (item: InventoryRecord): string => {
    const name = item.item_name.toLowerCase().trim();
    if (name === 'rice') return 'kg';
    if (name === 'chicken') return 'kg';
    if (name === 'masala' || name === 'masalas') return 'kg';
    if (name === 'oil' || name === 'cooking oil') return 'litres';
    if (name === 'gas' || name === 'gas cylinder' || name === 'gas cylinders') return 'cylinders';
    return item.unit || 'pcs';
  };

  const getStockStatus = (item: InventoryRecord): 'in_stock' | 'low_stock' | 'out_of_stock' => {
    const qty = Number(item.current_stock ?? item.quantity ?? 0);
    const min = Number(item.minimum_stock ?? item.low_stock_threshold ?? 0);
    if (qty <= 0) return 'out_of_stock';
    if (qty <= min) return 'low_stock';
    return 'in_stock';
  };

  const getStatusStyle = (status: 'in_stock' | 'low_stock' | 'out_of_stock') => {
    return { 
      in_stock: { color: '#22C55E', bg: '#DCFCE7' }, 
      low_stock: { color: '#F59E0B', bg: '#FEF3C7' }, 
      out_of_stock: { color: '#EF4444', bg: '#FEE2E2' } 
    }[status];
  };

  const getProgressWidth = (item: InventoryRecord): number => {
    const qty = Number(item.current_stock ?? item.quantity ?? 0);
    const min = Number(item.minimum_stock ?? item.low_stock_threshold ?? 0);
    const max = min * 3;
    return max > 0 ? Math.min(1, qty / max) : 0;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const cleanDate = dateStr.split('T')[0];
      const parts = cleanDate.split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const monthIndex = parseInt(parts[1]) - 1;
        const day = parseInt(parts[2]).toString();
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${day} ${months[monthIndex]} ${year}`;
      }
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch {
      return '';
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Inventory</Text>
          <Text style={styles.headerSubtitle}>Stock Management</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />
        }
        showsVerticalScrollIndicator={false}
      >
        {inventoryLoading && inventory.length === 0 ? (
          <ListSkeleton count={5} />
        ) : inventory.length === 0 ? (
          <EmptyState emoji="📦" title={t('inventory.empty')} />
        ) : (
          inventory.map((item) => {
            const status = getStockStatus(item);
            const statusStyle = getStatusStyle(status);
            const progressWidth = getProgressWidth(item);
            const tracked = isTrackedItem(item.item_name);
            const isPendingPayment = item.payment_status === 'Pending';

            return (
              <TouchableOpacity 
                key={item.id} 
                style={[styles.itemCard, SHADOW.sm]}
                activeOpacity={tracked ? 0.9 : 0.7}
                onPress={() => {
                  
                  if (tracked) {
                    Alert.alert(
                      "Tracked Item",
                      `Manual stock updates are disabled for "${t(`inventory.items.${item.item_name}`) || item.item_name}". Stock levels and prices are automatically synced from Purchases.`
                    );
                    return;
                  }
                  if (activeStaff && !activePermissions?.inventory) return;
                  setSelectedItem(item);
                  setNewQty('');
                }}
              >
                <View style={styles.itemHeader}>
                  <View style={styles.itemInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.itemName}>
                        {t(`inventory.items.${item.item_name}`) || item.item_name}
                      </Text>
                      {tracked && (
                        <Ionicons name="lock-closed" size={13} color="#94A3B8" />
                      )}
                    </View>
                    <View style={styles.qtyRow}>
                      <Text style={styles.currentQtyText}>
                        <Text style={{ fontWeight: '800' }}>{item.current_stock ?? item.quantity}</Text> {getItemUnit(item)}
                      </Text>
                      <Text style={styles.minQtyText}>
                        Min: {item.minimum_stock ?? item.low_stock_threshold} {getItemUnit(item)}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.itemRight}>
                    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      {/* Payment Status Badge */}
                      <View style={[
                        styles.statusBadge,
                        { backgroundColor: isPendingPayment ? '#FEF3C7' : '#DCFCE7' }
                      ]}>
                        <Text style={[
                          styles.statusBadgeText,
                          { color: isPendingPayment ? '#D97706' : '#15803D' }
                        ]}>
                          {isPendingPayment ? '🟡 Pending' : '🟢 Paid'}
                        </Text>
                      </View>

                      {/* Stock Status Badge */}
                      <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                        <Text style={[styles.statusBadgeText, { color: statusStyle.color }]}>
                          {t(`inventory.status.${status}`) || status.replace('_', ' ')}
                        </Text>
                      </View>
                    </View>

                    {(item.last_purchase_date || item.last_updated) && (
                      <Text style={styles.lastUpdatedText}>
                        Updated: {formatDate(item.last_purchase_date || item.last_updated)}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressBg}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${(progressWidth * 100).toFixed(0)}%` as `${number}%`,
                        backgroundColor: statusStyle.color,
                      },
                    ]}
                  />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* FAB */}
      {(!activeStaff || activePermissions?.inventory) && (
        <TouchableOpacity
          style={[styles.fab, SHADOW.md]}
          activeOpacity={0.8}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={28} color="#FFF" />
        </TouchableOpacity>
      )}

      {/* Update Stock Modal */}
      <Modal
        visible={selectedItem !== null}
        animationType="slide"
        presentationStyle="formSheet"
        transparent={false}
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Update {selectedItem ? t(`inventory.items.${selectedItem.item_name}`) || selectedItem.item_name : ''}
            </Text>
            <TouchableOpacity onPress={() => setSelectedItem(null)}>
              <Ionicons name="close" size={24} color="#0F172A" />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalContent}>
              <View style={[styles.formCard, SHADOW.sm]}>
                {selectedItem && (
                  <View style={styles.currentQtyCard}>
                    <Text style={styles.currentQtyLabel}>
                      {t('inventory.current_stock')}
                    </Text>
                    <Text style={styles.currentQtyValue}>
                      {selectedItem.current_stock ?? selectedItem.quantity} {getItemUnit(selectedItem)}
                    </Text>
                  </View>
                )}
                <Input
                  label={t('inventory.add_stock')}
                  value={newQty}
                  onChangeText={setNewQty}
                  keyboardType="decimal-pad"
                  suffix={selectedItem ? getItemUnit(selectedItem) : undefined}
                  autoFocus
                />
                <Button
                  title={updating ? t('common.loading') : t('inventory.update')}
                  onPress={handleUpdate}
                  loading={updating}
                  fullWidth
                  size="lg"
                  style={{ marginTop: 8 }}
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Create Item Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="formSheet"
        transparent={false}
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Item</Text>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Ionicons name="close" size={24} color="#0F172A" />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <View style={[styles.formCard, SHADOW.sm]}>
                <Input
                  label="Item Name"
                  value={newItemForm.itemName}
                  onChangeText={(v) => setNewItemForm({ ...newItemForm, itemName: v })}
                  placeholder="e.g. Chicken"
                />
                <Input
                  label="Unit"
                  value={newItemForm.unit}
                  onChangeText={(v) => setNewItemForm({ ...newItemForm, unit: v })}
                  placeholder="e.g. kg, liters, packets"
                />
                <Input
                  label="Current Stock"
                  value={newItemForm.currentStock}
                  onChangeText={(v) => setNewItemForm({ ...newItemForm, currentStock: v })}
                  keyboardType="decimal-pad"
                  placeholder="0"
                />
                <Input
                  label="Minimum Stock"
                  value={newItemForm.minStock}
                  onChangeText={(v) => setNewItemForm({ ...newItemForm, minStock: v })}
                  keyboardType="decimal-pad"
                  placeholder="0"
                />
                <Button
                  title={creating ? 'Saving...' : 'Save'}
                  onPress={handleCreate}
                  loading={creating}
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
  scroll: { padding: 20, gap: 12, paddingBottom: 100 }, // added bottom padding for FAB
  
  itemCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 16,
  },
  itemHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    alignItems: 'center', 
  },
  itemInfo: { flex: 1, gap: 4 },
  itemName: { 
    fontSize: 16, 
    fontWeight: '700',
    color: '#0F172A', 
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currentQtyText: { 
    fontSize: 14, 
    color: '#475569' 
  },
  minQtyText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  itemRight: { 
    alignItems: 'flex-end', 
    justifyContent: 'center',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  progressBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },

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
  formCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  currentQtyCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  currentQtyLabel: { 
    fontSize: 13,
    color: '#64748B', 
  },
  currentQtyValue: { 
    fontSize: 24, 
    fontWeight: '800', 
    color: '#0F172A',
    marginTop: 4, 
  },
  lastUpdatedText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 6,
    fontWeight: '600',
  },
});
