import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SHADOW } from '@/constants/theme';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Types ─────────────────────────────────────────────────────
export interface PurchaseItem {
  id: string;
  name: string;
  qty: string;
  unit: string;
  price: string;
  total: number;
}

interface StorePurchaseFormProps {
  onTotalChange: (grandTotal: number, items: PurchaseItem[]) => void;
  categoryKey?: string;
}

// ── Suggestion Lists per Category ─────────────────────────────
const SUGGESTIONS: Record<string, string[]> = {
  store_purchases: [
    'Eggs', 'Cooking Oil', 'Rice', 'Paper Cups', 'Parcel Covers',
    'Plastic Covers', 'Tissue Paper', 'Rubber Bands', 'Match Box',
    'Plastic Spoons', 'Carry Bags', 'Aluminium Foil', 'Cling Wrap',
    'Napkins', 'Toothpicks', 'Straws',
  ],
  market_purchases: [
    'Tomato', 'Onion', 'Potato', 'Green Chilli', 'Ginger',
    'Garlic', 'Coriander', 'Curry Leaves', 'Lemon', 'Coconut',
    'Carrot', 'Beans', 'Drumstick', 'Brinjal', 'Ladies Finger',
    'Cabbage', 'Banana Leaf',
  ],
  indian_market: [
    'Turmeric', 'Chilli Powder', 'Coriander Powder', 'Cumin',
    'Mustard Seeds', 'Urad Dal', 'Chana Dal', 'Toor Dal',
    'Tamarind', 'Jaggery', 'Coconut Oil', 'Gingelly Oil',
    'Atta', 'Maida', 'Rava', 'Salt', 'Sugar',
  ],
};

const UNIT_OPTIONS = ['Nos', 'Kg', 'g', 'Litres', 'ml', 'Pack', 'Box', 'Dozen', 'Bundle'];

// ── Helper ────────────────────────────────────────────────────
function generateId() {
  return 'pi_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
}

function createEmptyItem(): PurchaseItem {
  return { id: generateId(), name: '', qty: '', unit: 'Nos', price: '', total: 0 };
}

// ── Component ─────────────────────────────────────────────────
export function StorePurchaseForm({ onTotalChange, categoryKey = 'store_purchases' }: StorePurchaseFormProps) {
  const [items, setItems] = useState<PurchaseItem[]>([createEmptyItem()]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [showUnitPicker, setShowUnitPicker] = useState<string | null>(null);

  const suggestions = SUGGESTIONS[categoryKey] || SUGGESTIONS.store_purchases;

  // Calculate grand total whenever items change
  const grandTotal = items.reduce((sum, item) => sum + item.total, 0);

  useEffect(() => {
    onTotalChange(grandTotal, items);
  }, [grandTotal, items.length]);

  // ── Item update handler ──────────────────────────────────
  const updateItem = (id: string, field: keyof PurchaseItem, value: string) => {
    setItems((prev) => {
      return prev.map((item) => {
        if (item.id !== id) return item;

        const updated = { ...item, [field]: value };

        // Recalculate total
        const qty = parseFloat(updated.qty) || 0;
        const price = parseFloat(updated.price) || 0;
        updated.total = qty * price;

        return updated;
      });
    });
  };

  // ── Add new row ──────────────────────────────────────────
  const addItem = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    
    const newItem = createEmptyItem();
    setItems((prev) => [...prev, newItem]);
    setShowSuggestions(false);
  };

  // ── Remove row ───────────────────────────────────────────
  const removeItem = (id: string) => {
    if (items.length <= 1) return; // Keep at least one row
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  // ── Quick add from suggestions ───────────────────────────
  const addSuggestion = (name: string) => {
    

    // Check if first item is empty — fill it
    const firstEmpty = items.find((i) => i.name === '');
    if (firstEmpty) {
      updateItem(firstEmpty.id, 'name', name);
      return;
    }

    // Add new item with name pre-filled
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newItem = { ...createEmptyItem(), name };
    setItems((prev) => [...prev, newItem]);
  };

  // ── Notify parent of changes ─────────────────────────────
  useEffect(() => {
    const validItems = items.filter((i) => i.name.trim() !== '' && i.total > 0);
    onTotalChange(grandTotal, validItems);
  }, [items]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="receipt-outline" size={18} color="#F97316" />
          <Text style={styles.headerText}>Purchase Items</Text>
        </View>
        <Text style={styles.itemCount}>{items.filter((i) => i.name.trim()).length} items</Text>
      </View>

      {/* Quick Suggestions */}
      {showSuggestions && (
        <View style={styles.suggestionsSection}>
          <Text style={styles.suggestionsLabel}>Quick Add</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.suggestionsRow}>
              {suggestions.map((name) => {
                const alreadyAdded = items.some((i) => i.name === name);
                return (
                  <TouchableOpacity
                    key={name}
                    style={[styles.suggestionChip, alreadyAdded && styles.suggestionChipAdded]}
                    onPress={() => !alreadyAdded && addSuggestion(name)}
                    disabled={alreadyAdded}
                  >
                    {alreadyAdded ? (
                      <Ionicons name="checkmark" size={14} color="#22C55E" />
                    ) : (
                      <Ionicons name="add" size={14} color="#F97316" />
                    )}
                    <Text
                      style={[
                        styles.suggestionText,
                        alreadyAdded && { color: '#94A3B8' },
                      ]}
                    >
                      {name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Toggle Suggestions */}
      <TouchableOpacity
        style={styles.toggleSuggestions}
        onPress={() => {
          setShowSuggestions(!showSuggestions);
          
        }}
      >
        <Ionicons
          name={showSuggestions ? 'chevron-up' : 'chevron-down'}
          size={16}
          color="#94A3B8"
        />
        <Text style={styles.toggleText}>
          {showSuggestions ? 'Hide suggestions' : 'Show suggestions'}
        </Text>
      </TouchableOpacity>

      {/* Column Header */}
      <View style={styles.columnHeader}>
        <Text style={[styles.colLabel, { flex: 2.5 }]}>Item</Text>
        <Text style={[styles.colLabel, { flex: 1 }]}>Qty</Text>
        <Text style={[styles.colLabel, { flex: 1.2 }]}>Unit</Text>
        <Text style={[styles.colLabel, { flex: 1.2 }]}>Price</Text>
        <Text style={[styles.colLabel, { flex: 1.2, textAlign: 'right' }]}>Total</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Item Rows */}
      {items.map((item, index) => (
        <View key={item.id} style={styles.itemRow}>
          {/* Row number */}
          <View style={styles.rowNumber}>
            <Text style={styles.rowNumberText}>{index + 1}</Text>
          </View>

          <View style={styles.itemFields}>
            {/* Item Name */}
            <TextInput
              style={[styles.fieldInput, { flex: 2.5 }]}
              value={item.name}
              onChangeText={(v) => updateItem(item.id, 'name', v)}
              placeholder="Item name"
              placeholderTextColor="#CBD5E1"
              onFocus={() => setActiveItemId(item.id)}
            />

            {/* Quantity */}
            <TextInput
              style={[styles.fieldInput, styles.numericInput, { flex: 1 }]}
              value={item.qty}
              onChangeText={(v) => updateItem(item.id, 'qty', v)}
              placeholder="0"
              placeholderTextColor="#CBD5E1"
              keyboardType="decimal-pad"
            />

            {/* Unit Picker */}
            <TouchableOpacity
              style={[styles.unitPicker, { flex: 1.2 }]}
              onPress={() => {
                
                setShowUnitPicker(showUnitPicker === item.id ? null : item.id);
              }}
            >
              <Text style={styles.unitText}>{item.unit}</Text>
              <Ionicons name="chevron-down" size={12} color="#94A3B8" />
            </TouchableOpacity>

            {/* Price */}
            <TextInput
              style={[styles.fieldInput, styles.numericInput, { flex: 1.2 }]}
              value={item.price}
              onChangeText={(v) => updateItem(item.id, 'price', v)}
              placeholder="₹0"
              placeholderTextColor="#CBD5E1"
              keyboardType="decimal-pad"
            />

            {/* Total (read-only) */}
            <View style={[styles.totalCell, { flex: 1.2 }]}>
              <Text
                style={[
                  styles.totalText,
                  item.total > 0 && styles.totalTextActive,
                ]}
              >
                ₹{item.total > 0 ? item.total.toLocaleString('en-IN') : '0'}
              </Text>
            </View>

            {/* Delete */}
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => removeItem(item.id)}
              disabled={items.length <= 1}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={items.length <= 1 ? '#E2E8F0' : '#EF4444'}
              />
            </TouchableOpacity>
          </View>

          {/* Unit Picker Dropdown */}
          {showUnitPicker === item.id && (
            <View style={styles.unitDropdown}>
              {UNIT_OPTIONS.map((unit) => (
                <TouchableOpacity
                  key={unit}
                  style={[
                    styles.unitOption,
                    item.unit === unit && styles.unitOptionActive,
                  ]}
                  onPress={() => {
                    updateItem(item.id, 'unit', unit);
                    setShowUnitPicker(null);
                    
                  }}
                >
                  <Text
                    style={[
                      styles.unitOptionText,
                      item.unit === unit && styles.unitOptionTextActive,
                    ]}
                  >
                    {unit}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      ))}

      {/* Add Item Button */}
      <TouchableOpacity style={styles.addButton} onPress={addItem}>
        <Ionicons name="add-circle-outline" size={22} color="#F97316" />
        <Text style={styles.addButtonText}>Add Item</Text>
      </TouchableOpacity>

      {/* Grand Total */}
      <View style={styles.grandTotalBox}>
        <View style={styles.grandTotalLeft}>
          <Ionicons name="calculator-outline" size={20} color="#F97316" />
          <Text style={styles.grandTotalLabel}>Subtotal</Text>
        </View>
        <Text style={styles.grandTotalValue}>
          ₹{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </Text>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
    ...SHADOW.sm,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  itemCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  // Suggestions
  suggestionsSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  suggestionsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  suggestionsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: 20,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  suggestionChipAdded: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  suggestionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },

  // Toggle
  toggleSuggestions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  toggleText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },

  // Column Header
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    gap: 6,
  },
  colLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Item Row
  itemRow: {
    borderBottomWidth: 1,
    borderColor: '#F8FAFC',
  },
  rowNumber: {
    position: 'absolute',
    left: 4,
    top: 12,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  rowNumberText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
  },
  itemFields: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingLeft: 26,
    paddingVertical: 8,
    gap: 6,
  },

  // Fields
  fieldInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '500',
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  numericInput: {
    textAlign: 'center',
  },

  // Unit Picker
  unitPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 2,
  },
  unitText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },

  // Unit Dropdown
  unitDropdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 6,
  },
  unitOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  unitOptionActive: {
    backgroundColor: '#F97316',
  },
  unitOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  unitOptionTextActive: {
    color: '#FFF',
  },

  // Total cell
  totalCell: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  totalText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  totalTextActive: {
    color: '#0F172A',
    fontWeight: '800',
  },

  // Delete button
  deleteBtn: {
    padding: 4,
    width: 32,
    alignItems: 'center',
  },

  // Add button
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FED7AA',
    borderStyle: 'dashed',
    backgroundColor: '#FFFBF5',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F97316',
  },

  // Grand Total
  grandTotalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  grandTotalLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  grandTotalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
  },
  grandTotalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F97316',
  },
});
