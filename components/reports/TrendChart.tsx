import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { LineChart, BarChart, PieChart } from 'react-native-gifted-charts';
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { ReportDataPoint } from '@/types';
import { formatCurrency } from '@/lib/utils';

interface TrendChartProps {
  data: ReportDataPoint[];
  title: string;
  type?: 'line' | 'bar' | 'pie';
  color?: string;
  period?: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

export function TrendChart({ data, title, type = 'line', color = COLORS.primary, period = 'daily' }: TrendChartProps) {
  const { colors, isDark } = useTheme();
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const CHART_WIDTH = SCREEN_WIDTH - 64;

  const hasData = useMemo(() => {
    return data.some(d => d.totalSales > 0 || d.totalExpenses > 0);
  }, [data]);

  if (!data || data.length === 0 || !hasData) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface }, SHADOW.sm]}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <View style={styles.empty}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>📊</Text>
          <Text style={{ color: colors.textTertiary, fontSize: FONTS.size.md, textAlign: 'center' }}>
            No report data available for the selected period.
          </Text>
        </View>
      </View>
    );
  }

  const safeValue = (val: any) => (Number.isFinite(Number(val)) ? Number(val) : 0);

  // Format X-axis label based on period
  const formatLabel = (label: string, index: number, total: number) => {
    if (period === 'daily') {
      // label is like '00:00', '01:00'
      const hour = parseInt(label.split(':')[0]);
      if (hour % 3 === 0) { // Show 12 AM, 3 AM, 6 AM...
        return hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;
      }
      return '';
    } else if (period === 'weekly') {
      // Try to parse day name if possible, or just return short version
      if (label.length >= 10) {
        const d = new Date(label);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString('en-US', { weekday: 'short' });
        }
      }
      return label.substring(0, 3);
    } else if (period === 'monthly') {
      // 1-31, only show every 5 days
      if (index === 0 || index === total - 1 || index % 5 === 0) {
        if (label.length >= 10) return parseInt(label.split('-')[2]).toString();
        return label;
      }
      return '';
    } else if (period === 'yearly') {
      // Jan-Dec
      if (label.length === 7) {
        const d = new Date(label + '-01');
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString('en-US', { month: 'short' });
        }
      }
      return label;
    }
    return label;
  };

  const salesData = data.map((d, i) => {
    let dateStr = d.date || '';
    if (period === 'daily') {
      dateStr = d.label || d.date; // e.g. "12:00"
    } else if (period === 'weekly' || period === 'monthly') {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const dateObj = new Date(dateStr);
        if (period === 'weekly') {
          dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'short' }) + ' ' + parts[2];
        } else {
          dateStr = parts[2] + ' ' + dateObj.toLocaleDateString('en-US', { month: 'short' });
        }
      }
    } else if (period === 'yearly') {
      const parts = dateStr.split('-');
      if (parts.length >= 2) {
        const dateObj = new Date(dateStr + '-01');
        dateStr = dateObj.toLocaleDateString('en-US', { month: 'short' }) + ' ' + parts[0];
      }
    }
    return { 
      value: safeValue(d.totalSales), 
      label: dateStr,
      dateLabel: d.date,
      sales: safeValue(d.totalSales),
      expenses: safeValue(d.totalExpenses),
      profit: safeValue(d.totalProfit),
    };
  });
  
  const expData = data.map((d, i) => ({ 
    value: safeValue(d.totalExpenses), 
  }));
  
  const profitData = data.map((d, i) => ({ 
    value: safeValue(d.totalProfit), 
  }));

  console.log("[TrendChart] final dataset:", JSON.stringify(salesData, null, 2));

  const yAxisLabelFormatter = (val: string) => {
    const num = parseInt(val);
    if (isNaN(num)) return val;
    if (num >= 1000) {
      return `₹${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}k`;
    }
    return `₹${num}`;
  };

  const chartProps = {
    width: CHART_WIDTH - 20,
    height: 220,
    initialSpacing: 20,
    spacing: Math.max(30, (CHART_WIDTH - 50) / (data.length || 1)),
    noOfSections: 4,
    yAxisColor: 'transparent',
    xAxisColor: colors.border,
    yAxisTextStyle: { color: colors.textTertiary, fontSize: 10 },
    xAxisLabelTextStyle: { color: colors.textTertiary, fontSize: 10 },
    yAxisLabelFormatter,
    hideDataPoints: data.length > 1,
    curved: true,
    areaChart: true,
    rulesType: 'solid' as const,
    rulesColor: isDark ? '#302E2B' : '#F0EDE8',
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }, SHADOW.sm]}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <View style={styles.legendRow}>
        <LegendDot color="#F97316" label="Sales" />
        <LegendDot color="#22C55E" label="Profit" />
        <LegendDot color="#EF4444" label="Expenses" />
      </View>

      {type === 'pie' ? (
        <View style={{ alignItems: 'center', paddingVertical: 10 }}>
          <PieChart
            data={[
              {
                value: data.reduce((acc, curr) => acc + safeValue(curr.totalSales), 0),
                color: '#F97316',
                text: 'Sales',
              },
              {
                value: data.reduce((acc, curr) => acc + safeValue(curr.totalExpenses), 0),
                color: '#EF4444',
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
                    {profit > 0 ? '+' : ''}{formatCurrency(profit)}
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
          data={expData.map((d) => ({ ...d, frontColor: '#EF4444' + 'CC' }))}
          barBorderRadius={4}
          barWidth={Math.min(24, (CHART_WIDTH - 80) / (data.length * 2))}
        />
      ) : (
        <LineChart
          {...chartProps}
          data={salesData}
          color="#F97316"
          startFillColor="#F9731640"
          endFillColor="#F9731605"
          data2={profitData}
          color2="#22C55E"
          startFillColor2="transparent"
          endFillColor2="transparent"
          data3={expData}
          color3="#EF4444"
          startFillColor3="transparent"
          endFillColor3="transparent"
          pointerConfig={{
            pointerStripHeight: 160,
            pointerStripColor: 'lightgray',
            pointerStripWidth: 2,
            pointerColor: '#0F172A',
            radius: 6,
            pointerLabelWidth: 150,
            pointerLabelHeight: 100,
            activatePointersOnLongPress: false,
            autoAdjustPointerLabelPosition: true,
            pointerLabelComponent: (items: any) => {
              if (!items || !items[0]) return null;
              const item = items[0];
              const dateStr = item.dateLabel || '';
              // Format date nicely
              let displayDate = dateStr;
              if (period === 'daily') {
                const hour = parseInt(dateStr);
                displayDate = `Today at ${hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}`;
              } else if (dateStr.length === 10) {
                const d = new Date(dateStr);
                if (!isNaN(d.getTime())) displayDate = d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
              }
              return (
                <View style={styles.tooltipCard}>
                  <Text style={styles.tooltipDate}>{displayDate}</Text>
                  <View style={styles.tooltipRow}>
                    <View style={[styles.dot, { backgroundColor: '#F97316' }]} />
                    <Text style={styles.tooltipLabel}>Sales: </Text>
                    <Text style={[styles.tooltipValue, { color: '#F97316' }]}>{formatCurrency(item.sales)}</Text>
                  </View>
                  <View style={styles.tooltipRow}>
                    <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
                    <Text style={styles.tooltipLabel}>Expenses: </Text>
                    <Text style={[styles.tooltipValue, { color: '#EF4444' }]}>{formatCurrency(item.expenses)}</Text>
                  </View>
                  <View style={styles.tooltipRow}>
                    <View style={[styles.dot, { backgroundColor: '#22C55E' }]} />
                    <Text style={styles.tooltipLabel}>Profit: </Text>
                    <Text style={[styles.tooltipValue, { color: '#22C55E' }]}>{formatCurrency(item.profit)}</Text>
                  </View>
                </View>
              );
            },
          }}
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
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  tooltipCard: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    width: 140,
  },
  tooltipDate: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 4,
  },
  tooltipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  tooltipLabel: {
    fontSize: 11,
    color: '#64748B',
    marginLeft: 4,
    flex: 1,
  },
  tooltipValue: {
    fontSize: 11,
    fontWeight: 'bold',
  }
});
