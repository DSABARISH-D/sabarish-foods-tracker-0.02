import { supabase } from '@/lib/supabase';
import {
  CashBalanceUpdate,
  DashboardStats,
  Expense,
  ExpenseForm,
  InventoryRecord,
  Kadan,
  KadanForm,
  Sale,
  SaleForm,
  User,
} from '@/types';
import { getTodayDate, getMonthStart } from '@/lib/utils';

// ── Auth ──────────────────────────────────────────────────────────────
export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getUserProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data as User;
}

export async function fetchDashboardStats(userId: string, targetDate?: string): Promise<DashboardStats> {
  const date = targetDate || getTodayDate();
  const monthStart = date.substring(0, 8) + '01'; // Get first day of the selected month

  const [expensesToday, expensesMonth, cash] = await Promise.all([
    supabase
      .from('expenses')
      .select('amount')
      .eq('user_id', userId)
      .eq('date', date),
    supabase
      .from('expenses')
      .select('amount')
      .eq('user_id', userId)
      .gte('date', monthStart)
      .lte('date', date),
    supabase
      .from('cash_balance')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle(),
  ]);

  const sumAmounts = (rows: { amount: number }[] | null) =>
    (rows ?? []).reduce((s, r) => s + Number(r.amount), 0);

  const todayExpenses = sumAmounts(expensesToday.data);
  const monthlyExpenses = sumAmounts(expensesMonth.data);

  const cashData = cash.data as { petty_cash: number; cash_in_hand: number; cash_in_bank: number } | null;
  const petty = Number(cashData?.petty_cash ?? 0);
  const hand = Number(cashData?.cash_in_hand ?? 0);
  const bank = Number(cashData?.cash_in_bank ?? 0);

  // New Formula: Sales = (Cash in Hand + Cash in Bank) - Petty Cash
  // Note: If petty > hand+bank, sales will be negative.
  const todaySales = (hand + bank) - petty;

  // Monthly sales would require fetching all cash_balance rows for the month and summing their daily sales.
  // To keep it simple, we'll fetch them here.
  const { data: monthCash } = await supabase
    .from('cash_balance')
    .select('petty_cash, cash_in_hand, cash_in_bank')
    .eq('user_id', userId)
    .gte('date', monthStart)
    .lte('date', date);
  
  let monthlySales = 0;
  if (monthCash) {
    monthlySales = monthCash.reduce((sum, row) => {
      const p = Number(row.petty_cash ?? 0);
      const h = Number(row.cash_in_hand ?? 0);
      const b = Number(row.cash_in_bank ?? 0);
      return sum + ((h + b) - p);
    }, 0);
  }

  return {
    petty_cash: petty,
    cash_in_hand: hand,
    cash_in_bank: bank,
    today_sales: todaySales,
    today_expenses: todayExpenses,
    today_profit: todaySales - todayExpenses,
    monthly_sales: monthlySales,
    monthly_expenses: monthlyExpenses,
    monthly_profit: monthlySales - monthlyExpenses,
  };
}

// ── Sales ─────────────────────────────────────────────────────────────
export async function fetchSales(userId: string, date?: string): Promise<Sale[]> {
  let query = supabase
    .from('sales')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (date) query = query.eq('date', date);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Sale[];
}

export async function insertSale(userId: string, form: SaleForm): Promise<Sale> {
  const { data, error } = await supabase
    .from('sales')
    .insert({ ...form, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data as Sale;
}

export async function deleteSale(id: string): Promise<void> {
  const { error } = await supabase.from('sales').delete().eq('id', id);
  if (error) throw error;
}

// ── Expenses ──────────────────────────────────────────────────────────
export async function fetchExpenses(userId: string, date?: string): Promise<Expense[]> {
  let query = supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (date) query = query.eq('date', date);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Expense[];
}

export async function insertExpense(userId: string, form: ExpenseForm): Promise<Expense> {
  const { data, error } = await supabase
    .from('expenses')
    .insert({ ...form, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data as Expense;
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;
}

export async function lockExpensesForDate(userId: string, date: string): Promise<void> {
  const { error } = await supabase
    .from('expenses')
    .update({ locked: true })
    .eq('user_id', userId)
    .eq('date', date);
  if (error) throw error;
}

export async function checkDayLocked(userId: string, date: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('expenses')
    .select('locked')
    .eq('user_id', userId)
    .eq('date', date)
    .eq('locked', true)
    .limit(1);
  if (error) return false;
  return (data ?? []).length > 0;
}

// ── Inventory ─────────────────────────────────────────────────────────
export async function fetchInventory(userId: string): Promise<InventoryRecord[]> {
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .eq('user_id', userId)
    .order('item_name');
  if (error) throw error;
  return (data ?? []) as InventoryRecord[];
}

export async function upsertInventoryItem(
  userId: string,
  itemName: string,
  quantity: number
): Promise<void> {
  const { error } = await supabase
    .from('inventory')
    .update({ quantity, last_updated: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('item_name', itemName);
  if (error) throw error;
}

// ── Cash Balance ──────────────────────────────────────────────────────
export async function fetchCashBalance(userId: string, date?: string) {
  const targetDate = date || getTodayDate();
  const { data, error } = await supabase
    .from('cash_balance')
    .select('*')
    .eq('user_id', userId)
    .eq('date', targetDate)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function updateCashBalance(userId: string, updates: CashBalanceUpdate, date?: string): Promise<void> {
  const targetDate = date || getTodayDate();
  
  // Check if row exists for the date
  const { data: existing } = await supabase
    .from('cash_balance')
    .select('id')
    .eq('user_id', userId)
    .eq('date', targetDate)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('cash_balance')
      .update({ ...updates, last_updated: new Date().toISOString() })
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('cash_balance')
      .insert({ ...updates, user_id: userId, date: targetDate, last_updated: new Date().toISOString() });
    if (error) throw error;
  }
}

// ── Kadan ─────────────────────────────────────────────────────────────
export async function fetchKadan(userId: string): Promise<Kadan[]> {
  const { data, error } = await supabase
    .from('kadan')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const today = getTodayDate();
  return (data ?? []).map((k) => ({
    ...k,
    status: k.status === 'paid' ? 'paid' : k.due_date < today ? 'overdue' : k.status,
  })) as Kadan[];
}

export async function insertKadan(userId: string, form: KadanForm): Promise<Kadan> {
  const { data, error } = await supabase
    .from('kadan')
    .insert({ ...form, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data as Kadan;
}

export async function updateKadan(id: string, updates: Partial<KadanForm>): Promise<void> {
  const { error } = await supabase
    .from('kadan')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteKadan(id: string): Promise<void> {
  const { error } = await supabase.from('kadan').delete().eq('id', id);
  if (error) throw error;
}

export async function markKadanPaid(id: string): Promise<void> {
  const { error } = await supabase
    .from('kadan')
    .update({ status: 'paid', paid_date: getTodayDate(), updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ── Reports Data ──────────────────────────────────────────────────────
export async function fetchDailyReportData(userId: string) {
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  const results = await Promise.all(
    dates.map(async (date) => {
      const [cashRes, expRes] = await Promise.all([
        supabase.from('cash_balance').select('petty_cash, cash_in_hand, cash_in_bank').eq('user_id', userId).eq('date', date).maybeSingle(),
        supabase.from('expenses').select('amount').eq('user_id', userId).eq('date', date),
      ]);
      
      const p = Number(cashRes.data?.petty_cash ?? 0);
      const h = Number(cashRes.data?.cash_in_hand ?? 0);
      const b = Number(cashRes.data?.cash_in_bank ?? 0);
      const sales = (h + b) - p;

      const expenses = (expRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
      
      return { 
        label: date.slice(5), 
        sales: sales > 0 ? sales : 0, 
        expenses, 
        profit: sales - expenses 
      };
    })
  );

  return results;
}

export async function fetchExpensesByCategory(userId: string, period: 'daily' | 'weekly' | 'monthly') {
  let days = 0;
  if (period === 'weekly') days = 7;
  else if (period === 'monthly') days = 30;
  
  const d = new Date();
  d.setDate(d.getDate() - days);
  const startDate = d.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('expenses')
    .select('category, amount')
    .eq('user_id', userId)
    .gte('date', startDate);

  if (error || !data) return [];

  const grouped = data.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + Number(curr.amount);
    return acc;
  }, {} as Record<string, number>);

  return Object.keys(grouped).map(cat => ({
    category: cat,
    amount: grouped[cat]
  })).sort((a, b) => b.amount - a.amount);
}

export async function markSyncedToSheets(table: 'sales' | 'expenses', id: string): Promise<void> {
  const { error } = await supabase.from(table).update({ synced_to_sheets: true }).eq('id', id);
  if (error) throw error;
}
