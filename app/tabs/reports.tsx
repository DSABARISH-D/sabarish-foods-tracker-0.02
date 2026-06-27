import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Share,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/store';
import { TrendChart } from '@/components/reports/TrendChart';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { SHADOW } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { ReportDataPoint } from '@/types';
import { fetchDailyReportData, fetchExpensesByCategory } from '@/services/supabase.service';
import { formatCurrency, EXPENSE_CATEGORY_EMOJIS } from '@/lib/utils';
import { PieChart } from 'react-native-gifted-charts';
import { Ionicons } from '@expo/vector-icons';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_PAGE_WIDTH = SCREEN_WIDTH - 40; // 20px padding on each side

type Period = 'daily' | 'weekly' | 'monthly';

const PERIOD_TABS: { key: Period; label: string }[] = [
  { key: 'daily', label: 'reports.daily' },
  { key: 'weekly', label: 'reports.weekly' },
  { key: 'monthly', label: 'reports.monthly' },
];

const CATEGORY_COLORS: Record<string, string> = {
  chicken_cost: '#FF6B6B',
  market_purchases: '#4ECDC4',
  store_purchases: '#45B7D1',
  gas_cylinder: '#96CEB4',
  electricity: '#FFEEAD',
  indian_market: '#D4A5A5',
  staff: '#A8E6CF',
  transport: '#FFD3B6',
  other: '#DCDCDC',
};

const FALLBACK_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD', '#D4A5A5', '#A8E6CF', '#FFD3B6', '#DCDCDC'];

export default function ReportsScreen() {
  const { user } = useAuthStore();
  const { t } = useTranslation();

  const [period, setPeriod] = useState<Period>('daily');
  const [data, setData] = useState<ReportDataPoint[]>([]);
  const [categoryData, setCategoryData] = useState<{category: string, amount: number}[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const [selectedSlice, setSelectedSlice] = useState<{category: string, amount: number, percent: number} | null>(null);
  const [selectedSummarySlice, setSelectedSummarySlice] = useState<{label: string, amount: number, percent: number} | null>(null);
  
  const [currentPage, setCurrentPage] = useState(0);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [rows, catRows] = await Promise.all([
        fetchDailyReportData(user.id),
        fetchExpensesByCategory(user.id, period)
      ]);
      setData(rows);
      setCategoryData(catRows);
      setSelectedSlice(null);
      setSelectedSummarySlice(null);
    } catch {
      setData([]);
      setCategoryData([]);
    } finally {
      setLoading(false);
    }
  }, [user, period]);

  useEffect(() => { loadData(); }, [period]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleScroll = (event: any) => {
    const x = event.nativeEvent.contentOffset.x;
    const page = Math.round(x / CHART_PAGE_WIDTH);
    if (page !== currentPage) {
      setCurrentPage(page);
    }
  };

  const totalSales = data.reduce((s, d) => s + d.sales, 0);
  const totalExpenses = data.reduce((s, d) => s + d.expenses, 0);
  const totalProfit = totalSales - totalExpenses;
  
  const totalCategoryAmount = useMemo(() => categoryData.reduce((sum, item) => sum + item.amount, 0), [categoryData]);

  const pieDataSummary = useMemo(() => {
    const total = totalSales + totalExpenses + Math.max(0, totalProfit);
    if (total === 0) return [];
    
    return [
      { value: totalSales, color: '#10B981', label: 'Sales' },
      { value: totalExpenses, color: '#EF4444', label: 'Expenses' },
      { value: Math.max(0, totalProfit), color: '#3B82F6', label: 'Profit' },
    ].filter(i => i.value > 0).map(i => ({
      ...i,
      percent: (i.value / total) * 100,
      text: '',
      onPress: () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSelectedSummarySlice({ label: i.label, amount: i.value, percent: (i.value / total) * 100 });
      }
    }));
  }, [totalSales, totalExpenses, totalProfit]);

  const pieDataCategory = useMemo(() => {
    return categoryData.map((item, index) => {
      const percent = totalCategoryAmount > 0 ? (item.amount / totalCategoryAmount) * 100 : 0;
      const color = CATEGORY_COLORS[item.category] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
      
      return {
        value: item.amount,
        color,
        category: item.category,
        percent,
        text: '',
        onPress: () => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setSelectedSlice({ category: item.category, amount: item.amount, percent });
        }
      };
    });
  }, [categoryData, totalCategoryAmount]);

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const period_label = t(`reports.${period}`);
    const msg = `📊 *Sabarish Foods — ${period_label} Report*\n\n` +
      `📈 Total Sales: ${formatCurrency(totalSales)}\n` +
      `📉 Total Expenses: ${formatCurrency(totalExpenses)}\n` +
      `💰 Total Profit: ${formatCurrency(totalProfit)}\n\n` +
      `_Generated by Sabarish Foods App_`;

    try {
      await Share.share({ message: msg, title: 'Sabarish Foods Report' });
    } catch {
      Alert.alert(t('common.error'), t('errors.unknown'));
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reports</Text>
        <Text style={styles.headerSubtitle}>Business Analytics</Text>
      </View>

      {/* Period Tabs */}
      <View style={styles.tabContainer}>
        <View style={styles.tabRow}>
          {PERIOD_TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                period === tab.key && styles.tabActive,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setPeriod(tab.key);
              }}
            >
              <Text
                style={[
                  styles.tabLabel,
                  { color: period === tab.key ? '#FFF' : '#64748B' },
                ]}
              >
                {t(tab.label)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />
        }
      >
        {loading && data.length === 0 ? (
          <ListSkeleton count={4} />
        ) : data.length === 0 ? (
          <EmptyState emoji="📊" title={t('reports.no_data')} onAction={loadData} actionLabel={t('common.retry')} />
        ) : (
          <>
            {/* Summary Cards */}
            <View style={styles.summaryContainer}>
              <View style={styles.summaryRow}>
                <SummaryCard
                  label="Total Sales"
                  value={totalSales}
                  icon="trending-up"
                  color="#10B981"
                  bg="#D1FAE5"
                />
                <SummaryCard
                  label="Total Expenses"
                  value={totalExpenses}
                  icon="trending-down"
                  color="#EF4444"
                  bg="#FEE2E2"
                />
              </View>
              <SummaryCard
                label="Total Profit"
                value={totalProfit}
                icon="wallet"
                color={totalProfit >= 0 ? '#3B82F6' : '#EF4444'}
                bg={totalProfit >= 0 ? '#DBEAFE' : '#FEE2E2'}
                large
              />
            </View>

            {/* Swipeable Analytics Carousel */}
            <View style={[styles.carouselCard, SHADOW.sm]}>
              <View style={styles.carouselHeader}>
                <Text style={styles.carouselTitle}>
                  {currentPage === 0 ? 'Sales Trend' : currentPage === 1 ? 'Business Summary' : 'Expense Breakdown'}
                </Text>
              </View>

              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleScroll}
                style={{ flexGrow: 0 }}
              >
                {/* Page 1: Trend Chart */}
                <View style={styles.chartPage}>
                  <TrendChart
                    data={data}
                    title=""
                    type="line"
                    color="#F97316"
                  />
                </View>

                {/* Page 2: Business Summary Donut */}
                <View style={styles.chartPage}>
                  {pieDataSummary.length === 0 ? (
                    <Text style={styles.noDataText}>No data for this period</Text>
                  ) : (
                    <View style={styles.chartContainer}>
                      <PieChart
                        data={pieDataSummary}
                        donut
                        radius={110}
                        innerRadius={70}
                        innerCircleColor="#FFF"
                        centerLabelComponent={() => {
                          if (selectedSummarySlice) {
                            return (
                              <View style={styles.centerLabel}>
                                <Text style={styles.centerLabelPercent}>{selectedSummarySlice.percent.toFixed(1)}%</Text>
                                <Text style={styles.centerLabelAmount}>{formatCurrency(selectedSummarySlice.amount)}</Text>
                              </View>
                            );
                          }
                          return (
                            <View style={styles.centerLabel}>
                              <Text style={styles.centerLabelTitle}>Total</Text>
                              <Text style={styles.centerLabelAmount}>{formatCurrency(totalSales + totalExpenses + Math.max(0, totalProfit))}</Text>
                            </View>
                          );
                        }}
                      />
                      
                      {selectedSummarySlice && (
                        <View style={styles.selectedSliceDetails}>
                          <Text style={styles.selectedSliceName}>{selectedSummarySlice.label}</Text>
                          <Text style={styles.selectedSliceValue}>{formatCurrency(selectedSummarySlice.amount)}</Text>
                        </View>
                      )}

                      <View style={styles.legendContainer}>
                        {pieDataSummary.map((item, index) => (
                          <TouchableOpacity key={index} style={styles.legendItem} onPress={item.onPress}>
                            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                            <Text style={styles.legendText}>{item.label} — {formatCurrency(item.value)}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </View>

                {/* Page 3: Expense Breakdown Donut */}
                <View style={styles.chartPage}>
                  {categoryData.length === 0 ? (
                    <Text style={styles.noDataText}>No expenses for this period</Text>
                  ) : (
                    <View style={styles.chartContainer}>
                      <PieChart
                        data={pieDataCategory}
                        donut
                        radius={110}
                        innerRadius={70}
                        innerCircleColor="#FFF"
                        centerLabelComponent={() => {
                          if (selectedSlice) {
                            return (
                              <View style={styles.centerLabel}>
                                <Text style={styles.centerLabelPercent}>{selectedSlice.percent.toFixed(1)}%</Text>
                                <Text style={styles.centerLabelAmount}>{formatCurrency(selectedSlice.amount)}</Text>
                              </View>
                            );
                          }
                          return (
                            <View style={styles.centerLabel}>
                              <Text style={styles.centerLabelTitle}>Total</Text>
                              <Text style={styles.centerLabelAmount}>{formatCurrency(totalCategoryAmount)}</Text>
                            </View>
                          );
                        }}
                      />

                      {selectedSlice && (
                        <View style={styles.selectedSliceDetails}>
                          <Text style={styles.selectedSliceName}>
                             {EXPENSE_CATEGORY_EMOJIS[selectedSlice.category as keyof typeof EXPENSE_CATEGORY_EMOJIS] || ''} {t(`expenses.categories.${selectedSlice.category}`) || selectedSlice.category}
                          </Text>
                          <Text style={styles.selectedSliceValue}>{formatCurrency(selectedSlice.amount)}</Text>
                        </View>
                      )}

                      <View style={styles.legendContainer}>
                        {pieDataCategory.map((item, index) => (
                          <TouchableOpacity key={index} style={styles.legendItem} onPress={item.onPress}>
                            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                            <Text style={styles.legendText}>
                              {t(`expenses.categories.${item.category}`) || item.category} — {formatCurrency(item.value)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              </ScrollView>

              {/* Dots Indicator */}
              <View style={styles.paginationDots}>
                {[0, 1, 2].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      currentPage === i ? styles.dotActive : styles.dotInactive
                    ]}
                  />
                ))}
              </View>
            </View>

            {/* Export Section */}
            <TouchableOpacity
              style={[styles.exportBtn, SHADOW.sm]}
              onPress={handleShare}
            >
              <Ionicons name="share-outline" size={20} color="#0F172A" />
              <Text style={styles.exportBtnText}>Share Report</Text>
            </TouchableOpacity>
            
            <View style={{height: 20}} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryCard({
  label, value, icon, color, bg, large,
}: {
  label: string; value: number; icon: any;
  color: string; bg: string; large?: boolean;
}) {
  return (
    <View style={[styles.summaryCard, large && styles.summaryCardLarge]}>
      <View style={large ? styles.summaryHeaderLarge : styles.summaryHeader}>
        <View style={[styles.iconWrap, { backgroundColor: bg }]}>
          <Ionicons name={icon} size={large ? 24 : 18} color={color} />
        </View>
        <Text style={styles.summaryLabel}>{label}</Text>
      </View>
      <Text style={[styles.summaryValue, large && styles.summaryValueLarge]}>
        {formatCurrency(value)}
      </Text>
    </View>
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
  tabContainer: {
    backgroundColor: '#FFF',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#0F172A',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  scroll: {
    padding: 20,
    gap: 16,
  },
  summaryContainer: {
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  summaryCardLarge: {
    padding: 20,
  },
  summaryHeader: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  summaryHeaderLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  summaryValueLarge: {
    fontSize: 32,
  },
  
  carouselCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
    minHeight: 480,
  },
  carouselHeader: {
    padding: 20,
    paddingBottom: 0,
  },
  carouselTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  chartPage: {
    width: CHART_PAGE_WIDTH,
    padding: 20,
    paddingBottom: 40, // space for dots
  },
  paginationDots: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: '#0F172A',
    width: 12, // slightly longer for active
  },
  dotInactive: {
    backgroundColor: '#E2E8F0',
  },
  
  noDataText: {
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 30,
  },
  chartContainer: {
    alignItems: 'center',
  },
  centerLabel: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerLabelPercent: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  centerLabelTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  centerLabelAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 4,
  },
  selectedSliceDetails: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  selectedSliceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  selectedSliceValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  legendContainer: {
    width: '100%',
    marginTop: 24,
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  legendText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  exportBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
});
