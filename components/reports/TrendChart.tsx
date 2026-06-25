import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart, BarChart } from 'react-native-gifted-charts';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { ReportDataPoint } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 64;

interface TrendChartProps {
  data: ReportDataPoint[];
  title: string;
  type?: 'line' | 'bar';
  color?: string;
}

export function TrendChart({ data, title, type = 'line', color = COLORS.primary }: TrendChartProps) {
  const { colors, isDark } = useTheme();

  if (!data || data.length === 0) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface }, SHADOW.sm]}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <View style={styles.empty}>
          <Text style={{ color: colors.textTertiary, fontSize: FONTS.size.md }}>
            📊 No data available
          </Text>
        </View>
      </View>
    );
  }

  const salesData = data.map((d) => ({ value: d.sales, label: d.label }));
  const expData = data.map((d) => ({ value: d.expenses, label: d.label }));
  const profitData = data.map((d) => ({ value: Math.max(0, d.profit), label: d.label }));

  const chartProps = {
    width: CHART_WIDTH - 32,
    height: 180,
    initialSpacing: 10,
    spacing: Math.max(20, (CHART_WIDTH - 80) / (data.length || 1)),
    noOfSections: 4,
    yAxisColor: 'transparent',
    xAxisColor: colors.border,
    yAxisTextStyle: { color: colors.textTertiary, fontSize: 9 },
    xAxisLabelTextStyle: { color: colors.textTertiary, fontSize: 9 },
    hideDataPoints: false,
    curved: true,
    areaChart: true,
    rulesType: 'solid' as const,
    rulesColor: isDark ? '#302E2B' : '#F0EDE8',
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }, SHADOW.sm]}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <View style={styles.legendRow}>
        <LegendDot color={COLORS.primary} label="Sales" />
        <LegendDot color={COLORS.secondary} label="Profit" />
        <LegendDot color={COLORS.gradients.purple[0]} label="Expenses" />
      </View>

      {type === 'bar' ? (
        <BarChart
          {...chartProps}
          data={expData.map((d) => ({ ...d, frontColor: COLORS.gradients.purple[0] + 'CC' }))}
          barBorderRadius={4}
          barWidth={Math.min(24, (CHART_WIDTH - 80) / (data.length * 2))}
        />
      ) : (
        <LineChart
          {...chartProps}
          data={salesData}
          color={COLORS.primary}
          startFillColor={COLORS.primary + '40'}
          endFillColor={COLORS.primary + '05'}
          data2={profitData}
          color2={COLORS.secondary}
          startFillColor2={COLORS.secondary + '40'}
          endFillColor2={COLORS.secondary + '05'}
        />
      )}
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
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
  },
  legendRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: FONTS.size.xs, color: '#9E9A94' },
  empty: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
