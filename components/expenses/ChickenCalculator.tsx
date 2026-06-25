import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { useTranslation } from '@/hooks/useTranslation';

interface ChickenCalculatorProps {
  onTotalChange: (total: number, kg: number, pricePerKg: number) => void;
}

export function ChickenCalculator({ onTotalChange }: ChickenCalculatorProps) {
  const { t } = useTranslation();

  const [pricePerKg, setPricePerKg] = useState('');
  const [quantityKg, setQuantityKg] = useState('');

  const priceNum = parseFloat(pricePerKg) || 0;
  const qtyNum = parseFloat(quantityKg) || 0;
  const total = priceNum * qtyNum;

  const handleChange = (price: string, qty: string) => {
    const p = parseFloat(price) || 0;
    const q = parseFloat(qty) || 0;
    const t = p * q;
    onTotalChange(t, q, p);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>
          {t('expenses.chicken_calculator')}
        </Text>
      </View>

      <View style={styles.row}>
        <View style={styles.field}>
          <Text style={styles.label}>
            {t('expenses.price_per_kg')}
          </Text>
          <View style={styles.inputWrap}>
            <Text style={styles.prefix}>₹</Text>
            <TextInput
              style={styles.input}
              value={pricePerKg}
              onChangeText={(v) => {
                setPricePerKg(v);
                handleChange(v, quantityKg);
              }}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#94A3B8"
            />
          </View>
        </View>

        <View style={styles.separator}>
          <Text style={styles.separatorText}>×</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>
            {t('expenses.quantity_kg')}
          </Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={quantityKg}
              onChangeText={(v) => {
                setQuantityKg(v);
                handleChange(pricePerKg, v);
              }}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#94A3B8"
            />
            <Text style={styles.suffix}>kg</Text>
          </View>
        </View>
      </View>

      {total > 0 && (
        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>
            {t('expenses.total_cost')}
          </Text>
          <Text style={styles.totalValue}>
            ₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F5F9FF',
    borderColor: '#3B82F6',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 4,
  },
  header: {
    marginBottom: 12,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3B82F6',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  field: { flex: 1 },
  separator: {
    marginTop: 20,
    alignItems: 'center',
    width: 20,
  },
  separatorText: {
    color: '#94A3B8',
    fontSize: 18,
    fontWeight: '600',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    color: '#64748B',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#0F172A',
  },
  prefix: {
    fontSize: 15,
    marginRight: 4,
    fontWeight: '500',
    color: '#64748B',
  },
  suffix: {
    fontSize: 13,
    marginLeft: 4,
    color: '#64748B',
  },
  totalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    padding: 12,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#3B82F6',
  },
});
