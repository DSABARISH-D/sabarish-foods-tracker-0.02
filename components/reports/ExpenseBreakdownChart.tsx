import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { FONTS, RADIUS, SHADOW, SPACING } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { formatCurrency } from '@/lib/utils';

interface ExpenseCategoryData {
  category: string;
  amount: number;
}

interface ExpenseBreakdownChartProps {
  data: ExpenseCategoryData[];
}

const CATEGORY_COLORS: Record<string, string> = {
  chicken_cost: '#22C55E', // Green
  market_purchases: '#3B82F6', // Blue
  store_purchases: '#3B82F6', // Blue (Grouped as Grocery)
  indian_market: '#EAB308', // Yellow
  staff: '#A855F7', // Purple
  gas_cylinder: '#F97316', // Orange
  electricity: '#EF4444', // Red
  water_supply: '#1F2937', // Black/Dark Gray
  transport: '#8B4513', // Brown
  other: '#9CA3AF', // Gray
};

const CATEGORY_LABELS: Record<string, string> = {
  chicken_cost: 'Chicken',
  market_purchases: 'Grocery',
  store_purchases: 'Grocery',
  indian_market: 'Indian Market',
  staff: 'Staff Salary',
  gas_cylinder: 'Gas',
  electricity: 'Electricity',
  water_supply: 'Water',
  transport: 'Transport',
  other: 'Other',
};

export function ExpenseBreakdownChart({ data }: ExpenseBreakdownChartProps) {
  const { colors } = useTheme();
  
  if (!data || data.length === 0) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface }, SHADOW.sm]}>
        <Text style={[styles.title, { color: colors.text }]}>Expense Breakdown</Text>
        <View style={styles.empty}>
          <Text style={{ color: colors.textTertiary, fontSize: FONTS.size.md }}>
            📊 No expenses yet
          </Text>
        </View>
      </View>
    );
  }

  // Aggregate by normalized labels (e.g., combine store_purchases and market_purchases into Grocery)
  const aggregatedData: Record<string, { amount: number; color: string; label: string }> = {};
  
  let totalExpenses = 0;

  data.forEach(item => {
    const label = CATEGORY_LABELS[item.category] || item.category;
    const color = CATEGORY_COLORS[item.category] || '#9CA3AF';
    
    if (!aggregatedData[label]) {
      aggregatedData[label] = { amount: 0, color, label };
    }
    aggregatedData[label].amount += Number(item.amount);
    totalExpenses += Number(item.amount);
  });

  const chartData = Object.values(aggregatedData)
    .sort((a, b) => b.amount - a.amount)
    .map(item => ({
      value: item.amount,
      color: item.color,
      label: item.label,
      percentage: ((item.amount / totalExpenses) * 100).toFixed(0),
    }));

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }, SHADOW.sm]}>
      <Text style={[styles.title, { color: colors.text }]}>Expense Breakdown</Text>
      
      <View style={{ alignItems: 'center', paddingVertical: 10 }}>
        <PieChart
          data={chartData}
          donut
          radius={90}
          innerRadius={60}
          showText
          textColor="#fff"
          textSize={12}
          centerLabelComponent={() => (
            <View style={{justifyContent: 'center', alignItems: 'center'}}>
              <Text style={{fontSize: 20, color: '#EF4444', fontWeight: 'bold'}}>
                {formatCurrency(totalExpenses)}
              </Text>
              <Text style={{fontSize: 12, color: colors.textTertiary}}>Total</Text>
            </View>
          )}
        />
      </View>

      <View style={styles.legendContainer}>
        {chartData.map((item, index) => (
          <View key={index} style={styles.legendRow}>
            <View style={styles.legendLeft}>
              <View style={[styles.dot, { backgroundColor: item.color }]} />
              <Text style={[styles.legendLabel, { color: colors.text }]}>{item.label}</Text>
            </View>
            <View style={styles.legendRight}>
              <Text style={[styles.legendAmount, { color: colors.textSecondary }]}>
                {formatCurrency(item.value)}
              </Text>
              <Text style={[styles.legendPercent, { color: colors.textTertiary }]}>
                ({item.percentage}%)
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: FONTS.size.md,
    fontWeight: FONTS.weight.semiBold,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  empty: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendContainer: {
    marginTop: SPACING.md,
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 100,
    justifyContent: 'flex-end',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLabel: {
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
  },
  legendAmount: {
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.semiBold,
  },
  legendPercent: {
    fontSize: FONTS.size.xs,
    width: 40,
    textAlign: 'right',
  },
});
