import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
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
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore, useInventoryStore, useExpensesStore } from '@/store';
import { TrendChart } from '@/components/reports/TrendChart';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { SHADOW } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { ReportDataPoint, Expense } from '@/types';
import { fetchReportDataByDateRange, fetchExpensesByCategory, fetchExpenses } from '@/services/supabase.service';
import { formatCurrency, EXPENSE_CATEGORY_EMOJIS, getLocalDateString } from '@/lib/utils';
import { PieChart } from 'react-native-gifted-charts';
import { Ionicons } from '@expo/vector-icons';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}


type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';

const PERIOD_TABS: { key: Period; label: string }[] = [
  { key: 'daily', label: 'reports.daily' },
  { key: 'weekly', label: 'reports.weekly' },
  { key: 'monthly', label: 'reports.monthly' },
  { key: 'yearly', label: 'reports.yearly' },
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
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const CHART_PAGE_WIDTH = SCREEN_WIDTH - 40;
  const { user, activeStaff } = useAuthStore();
  const { t } = useTranslation();
  const { inventory, loadInventory } = useInventoryStore();
  const { markExpensePaid } = useExpensesStore();

  const [period, setPeriod] = useState<Period>('daily');
  const [data, setData] = useState<ReportDataPoint[]>([]);
  const [categoryData, setCategoryData] = useState<{category: string, amount: number}[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const [selectedSlice, setSelectedSlice] = useState<{category: string, amount: number, percent: number} | null>(null);
  const [selectedSummarySlice, setSelectedSummarySlice] = useState<{label: string, amount: number, percent: number} | null>(null);
  
  const [currentPage, setCurrentPage] = useState(0);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const today = new Date();
      // Reset to midnight for consistency
      today.setHours(0, 0, 0, 0);
      let startDate = new Date(today);
      let endDate = new Date(today);

      if (period === 'daily') {
        // No change needed, startDate and endDate already set to today
        endDate.setHours(23, 59, 59, 999);
      } else if (period === 'weekly') {
        // Monday to Sunday of current week
        const day = startDate.getDay(); // 0 (Sun) - 6 (Sat)
        const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
        startDate = new Date(startDate.setDate(diff));
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
      } else if (period === 'monthly') {
        // First day of month
        startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        // Last day of month
        endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      } else if (period === 'yearly') {
        // First day of year
        startDate = new Date(startDate.getFullYear(), 0, 1);
        // Last day of year
        endDate = new Date(startDate.getFullYear(), 11, 31);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      }

      const sd = getLocalDateString(startDate);
      const ed = getLocalDateString(endDate);

      const [rows, catRows, allExp] = await Promise.all([
        fetchReportDataByDateRange(user.id, sd, ed),
        fetchExpensesByCategory(user.id, sd, ed),
        fetchExpenses(user.id),
        loadInventory().catch(() => {}),
      ]);

      // If yearly, group by month
      let finalRows = rows;
      if (period === 'yearly') {
        const monthlyData: Record<string, any> = {};
        rows.forEach(r => {
          const month = r.date.substring(0, 7); // YYYY-MM
          if (!monthlyData[month]) {
            monthlyData[month] = { ...r, label: month, date: month };
          } else {
            monthlyData[month].totalSales += r.totalSales;
            monthlyData[month].totalExpenses += r.totalExpenses;
            monthlyData[month].totalProfit += r.totalProfit;
            monthlyData[month].cashSales += r.cashSales;
            monthlyData[month].upiSales += r.upiSales;
            monthlyData[month].cashExpenses += r.cashExpenses;
            monthlyData[month].creditSales += r.creditSales;
            monthlyData[month].inventoryPurchases += r.inventoryPurchases;
          }
        });
        finalRows = Object.values(monthlyData).sort((a: any, b: any) => a.date.localeCompare(b.date));
      }

      setData(finalRows);
      setCategoryData(catRows);
      setAllExpenses(allExp || []);
      setSelectedSlice(null);
      setSelectedSummarySlice(null);
    } catch {
      setData([]);
      setCategoryData([]);
      setAllExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [user, period]);

  useEffect(() => { loadData(); }, [period]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

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

  const safeValue = (val: any) => (Number.isFinite(Number(val)) ? Number(val) : 0);

  const totalSales = data.reduce((s, d) => s + safeValue(d.totalSales), 0);
  const totalExpenses = data.reduce((s, d) => s + safeValue(d.totalExpenses), 0);
  const totalProfit = totalSales - totalExpenses;
  
  const cashSales = data.reduce((s, d) => s + safeValue(d.cashSales), 0);
  const upiSales = data.reduce((s, d) => s + safeValue(d.upiSales), 0);
  const cashExpenses = data.reduce((s, d) => s + safeValue(d.cashExpenses), 0);
  const creditSales = data.reduce((s, d) => s + safeValue(d.creditSales), 0);
  const inventoryPurchases = data.reduce((s, d) => s + safeValue(d.inventoryPurchases), 0);
  const totalTransactions = data.reduce((s, d) => s + safeValue(d.totalTransactions), 0);
  
  const totalCategoryAmount = useMemo(() => categoryData.reduce((sum, item) => sum + safeValue(item.amount), 0), [categoryData]);

  const pieDataSummary = useMemo(() => {
    const total = safeValue(totalSales) + safeValue(totalExpenses) + Math.max(0, safeValue(totalProfit));
    if (total === 0) return [];
    
    return [
      { value: safeValue(totalSales), color: '#10B981', label: 'Sales' },
      { value: safeValue(totalExpenses), color: '#EF4444', label: 'Expenses' },
      { value: Math.max(0, safeValue(totalProfit)), color: '#3B82F6', label: 'Profit' },
    ].filter(i => i.value > 0).map(i => ({
      ...i,
      percent: safeValue((i.value / total) * 100),
      text: '',
      onPress: () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSelectedSummarySlice({ label: i.label, amount: i.value, percent: safeValue((i.value / total) * 100) });
      }
    }));
  }, [totalSales, totalExpenses, totalProfit]);

  const pieDataCategory = useMemo(() => {
    return categoryData
      .filter(item => safeValue(item.amount) > 0)
      .map((item, index) => {
        const val = safeValue(item.amount);
        const percent = totalCategoryAmount > 0 ? safeValue((val / totalCategoryAmount) * 100) : 0;
        const color = CATEGORY_COLORS[item.category] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
        
        return {
          value: val,
          color,
          category: item.category,
          percent,
          text: '',
          onPress: () => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setSelectedSlice({ category: item.category, amount: val, percent });
          }
        };
    });
  }, [categoryData, totalCategoryAmount]);

  const handleShare = async () => {
    
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
        ) : (
          <>
            {/* Summary Cards */}
            <View style={styles.summaryContainer}>
              <View style={styles.summaryRow}>
                <SummaryCard
                  label="Total Sales"
                  value={totalSales}
                  icon="trending-up"
                  color="#F97316"
                  bg="#FFEDD5"
                />
                <SummaryCard
                  label="Total Expenses"
                  value={totalExpenses}
                  icon="trending-down"
                  color="#EF4444"
                  bg="#FEE2E2"
                />
              </View>
              <View style={styles.summaryRow}>
                <SummaryCard
                  label="Total Profit"
                  value={totalProfit}
                  icon="wallet"
                  color={totalProfit >= 0 ? '#22C55E' : '#EF4444'}
                  bg={totalProfit >= 0 ? '#DCFCE7' : '#FEE2E2'}
                />
                <SummaryCard
                  label="Transactions"
                  value={totalTransactions}
                  icon="swap-horizontal"
                  color="#8B5CF6"
                  bg="#EDE9FE"
                  isCount={true}
                />
              </View>
            </View>

            {/* Detailed Stats */}
            <View style={styles.summaryContainer}>
              <View style={styles.summaryRow}>
                <SummaryCard label="Cash Sales" value={cashSales} icon="cash-outline" color="#F59E0B" bg="#FEF3C7" />
                <SummaryCard label="UPI Sales" value={upiSales} icon="qr-code-outline" color="#8B5CF6" bg="#EDE9FE" />
              </View>
              <View style={styles.summaryRow}>
                <SummaryCard label="Cash Exp." value={cashExpenses} icon="wallet-outline" color="#F97316" bg="#FFEDD5" />
                <SummaryCard label="Credit (Kadan)" value={creditSales} icon="time-outline" color="#6366F1" bg="#E0E7FF" />
              </View>
              <SummaryCard label="Inventory Purchases" value={inventoryPurchases} icon="cart-outline" color="#06B6D4" bg="#CFFAFE" />
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
                <View style={[styles.chartPage, { width: CHART_PAGE_WIDTH }]}>
                  <TrendChart
                    data={data}
                    title=""
                    type="line"
                    color="#F97316"
                    period={period}
                  />
                </View>

                {/* Page 2: Business Summary Donut */}
                <View style={[styles.chartPage, { width: CHART_PAGE_WIDTH }]}>
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
                <View style={[styles.chartPage, { width: CHART_PAGE_WIDTH }]}>
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

            {/* ── Pending Rice Payments Section ── */}
            {(() => {
              const pendingRiceExpenses = allExpenses.filter(
                (e) => e.category === 'store_purchases' && 
                       e.payment_status === 'Pending' && 
                       e.description?.toLowerCase().includes('rice')
              );
              const totalPendingRiceAmount = pendingRiceExpenses.reduce((sum, e) => sum + e.amount, 0);

              const parseRiceDetailsLocal = (description?: string) => {
                if (!description) return { quantity: 'N/A', price: 'N/A' };
                const lines = description.split('\n');
                const qtyLine = lines.find(l => l.includes('×') || l.toLowerCase().includes('kg'));
                if (qtyLine) {
                  const parts = qtyLine.split('×');
                  const quantity = parts[0]?.trim() || 'N/A';
                  const price = parts[1]?.trim() || 'N/A';
                  return { quantity, price };
                }
                return { quantity: 'N/A', price: 'N/A' };
              };

              const handleMarkAsPaid = (expenseId: string, desc?: string) => {
                const isOwner = !activeStaff;
                if (!isOwner) return;
                
                Alert.alert(
                  "Confirm Payment",
                  `Mark "${desc?.split('\n')[0] || 'Rice'}" as Paid?`,
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Mark as Paid",
                      onPress: async () => {
                        try {
                          await markExpensePaid(expenseId);
                          
                          loadData();
                        } catch (err: any) {
                          Alert.alert("Error", err.message || "Failed to update payment status.");
                        }
                      }
                    }
                  ]
                );
              };

              return (
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Pending Rice Payments</Text>
                  
                  {/* Total Pending Rice Card */}
                  <View style={[styles.pendingTotalCard, SHADOW.sm]}>
                    <View style={styles.pendingTotalLeft}>
                      <View style={styles.pendingIconBox}>
                        <Ionicons name="time" size={24} color="#D97706" />
                      </View>
                      <View>
                        <Text style={styles.pendingTotalLabel}>Total Pending Rice Amount</Text>
                        <Text style={styles.pendingTotalValue}>{formatCurrency(totalPendingRiceAmount)}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Pending Rice List Table */}
                  <View style={[styles.reportTableCard, SHADOW.sm]}>
                    {pendingRiceExpenses.length === 0 ? (
                      <Text style={styles.noPendingText}>No pending rice payments</Text>
                    ) : (
                      <View>
                        <View style={styles.tableHeaderRow}>
                          <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Date</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Quantity</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Amount</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>Action</Text>
                        </View>
                        {pendingRiceExpenses.map((exp) => {
                          const { quantity } = parseRiceDetailsLocal(exp.description);
                          const isOwner = !activeStaff;
                          return (
                            <View key={exp.id} style={styles.tableDataRow}>
                              <Text style={[styles.tableDataCell, { flex: 1.2, fontSize: 13, fontWeight: '500' }]}>{exp.date}</Text>
                              <Text style={[styles.tableDataCell, { flex: 1, fontSize: 13, fontWeight: '600', color: '#475569' }]}>{quantity}</Text>
                              <Text style={[styles.tableDataCell, { flex: 1.2, fontSize: 13, fontWeight: '700', color: '#0F172A' }]}>{formatCurrency(exp.amount)}</Text>
                              <View style={{ flex: 1, alignItems: 'center' }}>
                                {isOwner ? (
                                  <TouchableOpacity
                                    style={styles.markPaidActionBtn}
                                    onPress={() => handleMarkAsPaid(exp.id, exp.description)}
                                  >
                                    <Ionicons name="checkmark-done" size={16} color="#FFF" />
                                  </TouchableOpacity>
                                ) : (
                                  <View style={styles.pendingBadgeLabel}>
                                    <Text style={styles.pendingBadgeText}>Pending</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                </View>
              );
            })()}



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
  label, value, icon, color, bg, large, isCount,
}: {
  label: string; value: number; icon: any;
  color: string; bg: string; large?: boolean; isCount?: boolean;
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
        {isCount ? value : formatCurrency(value)}
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
    paddingHorizontal: 20,
    paddingBottom: 40,
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
  sectionContainer: {
    marginTop: 20,
    marginHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  pendingTotalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF3C7', // light amber
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 12,
  },
  pendingTotalLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pendingIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingTotalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  pendingTotalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#78350F',
    marginTop: 2,
  },
  reportTableCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  noPendingText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 20,
    fontWeight: '500',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
    marginBottom: 8,
  },
  tableHeaderCell: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  tableDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  tableDataCell: {
    color: '#334155',
  },
  markPaidActionBtn: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pendingBadgeLabel: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
    textTransform: 'uppercase',
  },
  metricsGrid: {
    gap: 10,
    marginBottom: 12,
  },
  metricItemRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricHalfCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 6,
  },
  metricCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  metricCardValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  listSubtitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  alertSubHeader: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  noAlertsText: {
    fontSize: 12,
    color: '#94A3B8',
    paddingLeft: 6,
    fontStyle: 'italic',
  },
  alertRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  alertItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  alertItemQty: {
    fontSize: 13,
    fontWeight: '700',
  },
});
