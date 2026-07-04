import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart, BarChart, PieChart } from 'react-native-gifted-charts';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { ReportDataPoint } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 64;

interface TrendChartProps {
  data: ReportDataPoint[];
  title: string;
  type?: 'line' | 'bar' | 'pie';
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

  const safeValue = (val: any) => (Number.isFinite(Number(val)) ? Number(val) : 0);

  const salesData = data.map((d) => ({ value: safeValue(d.totalSales), label: d.label || '' }));
  const expData = data.map((d) => ({ value: safeValue(d.totalExpenses), label: d.label || '' }));
  const profitData = data.map((d) => ({ value: Math.max(0, safeValue(d.totalProfit)), label: d.label || '' }));
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

      {type === 'pie' ? (
        <View style={{ alignItems: 'center', paddingVertical: 10 }}>
          <PieChart
            data={[
              {
                value: data.reduce((acc, curr) => acc + safeValue(curr.totalSales), 0),
                color: COLORS.primary,
                text: 'Sales',
              },
              {
                value: data.reduce((acc, curr) => acc + safeValue(curr.totalExpenses), 0),
                color: COLORS.gradients.purple[0],
                text: 'Exp',
              },
            ].filter(item => item.value > 0) || [{ value: 1, color: '#f0f0f0' }]}
            donut
            radius={90}
            innerRadius={60}
            showText
            textColor="#fff"
            textSize={12}
            centerLabelComponent={() => {
              const totalS = data.reduce((acc, curr) => acc + safeValue(curr.totalSales), 0);
              const totalE = data.reduce((acc, curr) => acc + safeValue(curr.totalExpenses), 0);
              const profit = totalS - totalE;
              return (
                <View style={{justifyContent: 'center', alignItems: 'center'}}>
                  <Text style={{fontSize: 20, color: profit >= 0 ? '#22C55E' : '#EF4444', fontWeight: 'bold'}}>
                    {profit > 0 ? '+' : ''}{profit}
                  </Text>
                  <Text style={{fontSize: 12, color: colors.textTertiary}}>Profit</Text>
                </View>
              );
            }}
          />
        </View>
      ) : type === 'bar' ? (
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
          data3={expData}
          color3={COLORS.gradients.purple[0]}
          startFillColor3={COLORS.gradients.purple[0] + '40'}
          endFillColor3={COLORS.gradients.purple[0] + '05'}
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
