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
import * as Haptics from 'expo-haptics';
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
  const { user } = useAuthStore();
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Inventory item added successfully.');
      setShowCreateModal(false);
      setNewItemForm({ itemName: '', unit: '', currentStock: '', minStock: '' });
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || 'Failed to add item.');
    } finally {
      setCreating(false);
    }
  };

  const getStockStatus = (item: InventoryRecord): 'ok' | 'low' | 'critical' => {
    const ratio = item.quantity / item.low_stock_threshold;
    if (ratio > 1.5) return 'ok';
    if (ratio > 0) return 'low';
    return 'critical';
  };

  const getStatusStyle = (status: 'ok' | 'low' | 'critical') => {
    return { 
      ok: { color: '#22C55E', bg: '#DCFCE7' }, 
      low: { color: '#F59E0B', bg: '#FEF3C7' }, 
      critical: { color: '#EF4444', bg: '#FEE2E2' } 
    }[status];
  };

  const getProgressWidth = (item: InventoryRecord): number => {
    const max = item.low_stock_threshold * 3;
    return Math.min(1, item.quantity / max);
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

            return (
              <TouchableOpacity 
                key={item.id} 
                style={[styles.itemCard, SHADOW.sm]}
                activeOpacity={0.7}
                onPress={() => {
                  setSelectedItem(item);
                  setNewQty('');
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <View style={styles.itemHeader}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>
                      {t(`inventory.items.${item.item_name}`) || item.item_name}
                    </Text>
                    <View style={styles.qtyRow}>
                      <Text style={styles.currentQtyText}>
                        <Text style={{ fontWeight: '800' }}>{item.quantity}</Text> {item.unit}
                      </Text>
                      <Text style={styles.minQtyText}>
                        Min: {item.low_stock_threshold} {item.unit}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.itemRight}>
                    <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: statusStyle.color }]}>
                        {t(`inventory.status.${status}`)}
                      </Text>
                    </View>
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
      <TouchableOpacity
        style={[styles.fab, SHADOW.md]}
        activeOpacity={0.8}
        onPress={() => setShowCreateModal(true)}
      >
        <Ionicons name="add" size={28} color="#FFF" />
      </TouchableOpacity>

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
                      {selectedItem.quantity} {selectedItem.unit}
                    </Text>
                  </View>
                )}
                <Input
                  label={t('inventory.add_stock')}
                  value={newQty}
                  onChangeText={setNewQty}
                  keyboardType="decimal-pad"
                  suffix={selectedItem?.unit}
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
});
