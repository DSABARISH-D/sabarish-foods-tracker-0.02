import { supabase } from '@/lib/supabase';
import {
  CashBalanceUpdate,
  DashboardStats,
  Expense,
  ExpenseForm,
  ExpenseItem,
  InventoryRecord,
  Kadan,
  KadanForm,
  Sale,
  SaleForm,
  User,
} from '@/types';
import { getTodayDate, getLocalDateString } from '@/lib/utils';

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

  const cashData = cash.data as { petty_cash: number; cash_in_hand: number; cash_in_bank: number; cash_expenses?: number } | null;
  const petty = Number(cashData?.petty_cash ?? 0);
  const hand = Number(cashData?.cash_in_hand ?? 0);
  const bank = Number(cashData?.cash_in_bank ?? 0);
  const cashExp = Number(cashData?.cash_expenses ?? 0);

  // New Formula: Sales = (Cash in Hand + Cash in Bank + Cash Expenses) - Petty Cash
  const todaySales = (hand + bank + cashExp) - petty;

  // Monthly sales would require fetching all cash_balance rows for the month and summing their daily sales.
  // To keep it simple, we'll fetch them here.
  const { data: monthCash } = await supabase
    .from('cash_balance')
    .select('petty_cash, cash_in_hand, cash_in_bank, cash_expenses')
    .eq('user_id', userId)
    .gte('date', monthStart)
    .lte('date', date);
  
  let monthlySales = 0;
  if (monthCash) {
    monthlySales = monthCash.reduce((sum, row) => {
      const p = Number(row.petty_cash ?? 0);
      const h = Number(row.cash_in_hand ?? 0);
      const b = Number(row.cash_in_bank ?? 0);
      const ce = Number(row.cash_expenses ?? 0);
      return sum + ((h + b + ce) - p);
    }, 0);
  }

  return {
    petty_cash: petty,
    cash_in_hand: hand,
    cash_in_bank: bank,
    cash_expenses: cashExp,
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

export async function fetchExpenseItems(userId: string): Promise<ExpenseItem[]> {
  const { data, error } = await supabase
    .from('expense_items')
    .select('*')
    .eq('user_id', userId)
    .order('item_name');
  if (error) throw error;
  return (data ?? []) as ExpenseItem[];
}

export async function insertExpenseItem(userId: string, itemName: string, category: string): Promise<ExpenseItem> {
  const { data, error } = await supabase
    .from('expense_items')
    .insert({ user_id: userId, item_name: itemName, category })
    .select()
    .single();
  if (error) throw error;
  return data as ExpenseItem;
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
    .update({ 
      quantity, 
      current_stock: quantity,
      last_updated: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .eq('item_name', itemName);
  if (error) throw error;
}

export async function updateExpensePaymentStatus(
  id: string,
  paymentStatus: 'Paid' | 'Pending',
  paidDate?: string | null
): Promise<void> {
  const { error } = await supabase
    .from('expenses')
    .update({
      payment_status: paymentStatus,
      paid_date: paidDate,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);
  if (error) throw error;
}

export async function updateInventoryStockFull(
  userId: string,
  itemName: string,
  quantityToAdd: number,
  lastPurchasePrice: number,
  paymentStatus: 'Paid' | 'Pending',
  date?: string
): Promise<void> {
  const { data: existing, error: fetchErr } = await supabase
    .from('inventory')
    .select('quantity, current_stock, unit, low_stock_threshold')
    .eq('user_id', userId)
    .eq('item_name', itemName)
    .maybeSingle();
    
  if (fetchErr) throw fetchErr;
  
  const purchaseDate = date || getLocalDateString();
  
  if (existing) {
    const newQty = Math.max(0, (Number(existing.quantity) || 0) + quantityToAdd);
    const { error } = await supabase
      .from('inventory')
      .update({
        quantity: newQty,
        current_stock: newQty,
        last_purchase_date: purchaseDate,
        last_purchase_price: lastPurchasePrice,
        payment_status: paymentStatus,
        last_updated: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('item_name', itemName);
    if (error) throw error;
  } else {
    let unit = 'pcs';
    const lowerName = itemName.toLowerCase();
    if (lowerName.includes('oil')) unit = 'litres';
    else if (lowerName.includes('rice') || lowerName.includes('chicken') || lowerName.includes('masala')) unit = 'kg';
    else if (lowerName.includes('gas')) unit = 'cylinders';

    const safeQty = Math.max(0, quantityToAdd);
    const { error } = await supabase
      .from('inventory')
      .insert({
        user_id: userId,
        item_name: itemName,
        quantity: safeQty,
        current_stock: safeQty,
        unit: unit,
        low_stock_threshold: 5,
        minimum_stock: 5,
        last_purchase_date: purchaseDate,
        last_purchase_price: lastPurchasePrice,
        payment_status: paymentStatus,
        last_updated: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    if (error) throw error;
  }
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
export async function fetchReportDataByDateRange(userId: string, startDate: string, endDate: string) {
  // We need to fetch cash balances, kadan, and expenses within the range
  const [cashRes, expRes, kadanRes] = await Promise.all([
    supabase.from('cash_balance').select('*').eq('user_id', userId).gte('date', startDate).lte('date', endDate),
    supabase.from('expenses').select('*').eq('user_id', userId).gte('date', startDate).lte('date', endDate),
    supabase.from('kadan').select('*').eq('user_id', userId).gte('created_at', startDate + 'T00:00:00').lte('created_at', endDate + 'T23:59:59')
  ]);

  const cashData = cashRes.data || [];
  const expData = expRes.data || [];
  const kadanData = kadanRes.data || [];

  // Group by date
  const dateMap: Record<string, any> = {};

  // Initialize dates
  let current = new Date(startDate);
  const end = new Date(endDate);
  while (current <= end) {
    const dStr = getLocalDateString(current);
    dateMap[dStr] = {
      label: dStr.slice(5),
      date: dStr,
      totalSales: 0,
      totalExpenses: 0,
      totalProfit: 0,
      cashSales: 0,
      upiSales: 0,
      cashExpenses: 0,
      creditSales: 0,
      inventoryPurchases: 0
    };
    current.setDate(current.getDate() + 1);
  }

  cashData.forEach(row => {
    const date = row.date;
    if (dateMap[date]) {
      const p = Number(row.petty_cash || 0);
      const h = Number(row.cash_in_hand || 0);
      const b = Number(row.cash_in_bank || 0);
      const ce = Number(row.cash_expenses || 0);
      
      const sales = (h + b + ce) - p;
      dateMap[date].totalSales = sales > 0 ? sales : 0;
      dateMap[date].cashSales = (h + ce) - p > 0 ? (h + ce) - p : 0;
      dateMap[date].upiSales = b;
      dateMap[date].cashExpenses = ce;
    }
  });

  expData.forEach(row => {
    const date = row.date;
    if (dateMap[date]) {
      const amount = Number(row.amount || 0);
      dateMap[date].totalExpenses += amount;
      
      // Calculate inventory purchases (market, store, chicken)
      if (['market_purchases', 'store_purchases', 'chicken_cost'].includes(row.category)) {
        dateMap[date].inventoryPurchases += amount;
      }
    }
  });

  kadanData.forEach(row => {
    const date = (row.created_at || row.updated_at || new Date().toISOString()).split('T')[0];
    if (dateMap[date]) {
      dateMap[date].creditSales += Number(row.amount || 0);
    }
  });

  // Calculate profit
  Object.values(dateMap).forEach(d => {
    d.totalProfit = d.totalSales - d.totalExpenses;
  });

  return Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchExpensesByCategory(userId: string, startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('expenses')
    .select('category, amount')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate);

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

// ── Daily Totals for Google Sheets Sync ────────────────────────────────
export async function fetchDailyTotalsForSync(userId: string, date: string) {
  // Fetch Expenses
  const { data: expenses } = await supabase.from('expenses').select('*').eq('user_id', userId).eq('date', date);
  // Fetch Sales
  const { data: sales } = await supabase.from('sales').select('*').eq('user_id', userId).eq('date', date);
  // Fetch Cash Balance
  const { data: cash } = await supabase.from('cash_balance').select('*').eq('user_id', userId).eq('date', date).maybeSingle();
  // Fetch Kadan (Credit)
  // Kadan table doesn't have a date column, it uses created_at. We'll filter by date prefix.
  const { data: kadan } = await supabase.from('kadan').select('*').eq('user_id', userId).gte('created_at', `${date}T00:00:00`).lte('created_at', `${date}T23:59:59`);
  // Fetch Inventory (for daily status like Rice/Gas)
  const { data: inventory } = await supabase.from('inventory').select('*').eq('user_id', userId);

  const totals: any = {
    chicken_cost: 0,
    chicken_kg: 0,
    grocery: 0,
    indian_market: 0,
    store_purchase: 0,
    staff_salary: 0,
    gas: 0,
    electricity: 0,
    water_supply: 0,
    transport: 0,
    other_expenses: 0,
    cash_in_hand: 0,
    upi: 0,
    credit: 0
  };

  // 1. Process Expenses
  if (expenses) {
    expenses.forEach((e: any) => {
      const cat = e.category === 'market_purchases' ? 'grocery' :
                  e.category === 'store_purchases' ? 'store_purchase' :
                  e.category === 'staff' ? 'staff_salary' :
                  e.category === 'gas_cylinder' ? 'gas' :
                  e.category === 'other' ? 'other_expenses' :
                  e.category;
      
      if (totals[cat] !== undefined) {
        totals[cat] += Number(e.amount || 0);
      }
      if (e.category === 'chicken_cost' && e.chicken_kg) {
        totals.chicken_kg += Number(e.chicken_kg || 0);
      }
      
      // Store rice/gas payment status into notes
      if (e.payment_status && (cat === 'grocery' || cat === 'gas')) {
        const existingNotes = totals.notes || '';
        totals.notes = existingNotes ? `${existingNotes}, Payment: ${e.payment_status}` : `Payment: ${e.payment_status}`;
      }
    });
  }

  // 2. Process Sales
  if (sales) {
    sales.forEach((s: any) => {
      if (s.payment_method === 'cash') totals.cash_in_hand += Number(s.amount || 0);
      if (s.payment_method === 'upi') totals.upi += Number(s.amount || 0);
      if (s.payment_method === 'credit') totals.credit += Number(s.amount || 0);
    });
  }

  // 3. Process Cash Balance (Overrides sales if present, as cash balance is the single source of truth for dashboard)
  if (cash) {
    totals.cash_in_hand = Math.max(totals.cash_in_hand, Number(cash.cash_in_hand || 0));
    totals.upi = Math.max(totals.upi, Number(cash.cash_in_bank || 0)); // map cash_in_bank to upi
  }

  // 4. Process Kadan (Credit)
  if (kadan) {
    kadan.forEach((k: any) => {
      totals.credit += Number(k.amount || 0);
    });
  }

  // 5. Process Inventory Status
  if (inventory) {
    const rice = inventory.find((i: any) => i.item_name.toLowerCase().includes('rice'));
    const gas = inventory.find((i: any) => i.item_name.toLowerCase().includes('gas'));
    if (rice) totals.rice_status = `${rice.quantity} ${rice.unit}`;
    if (gas) totals.gas_status = `${gas.quantity} ${gas.unit}`;
  }

  return totals;
}

// ── Notes ─────────────────────────────────────────────────────────────

export const fetchNotes = async (restaurantId: string) => {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching notes:', error);
    throw error;
  }
  return data || [];
};

export const insertNote = async (
  restaurantId: string,
  userId: string,
  title: string,
  description: string,
  category: string | null
) => {
  const { data, error } = await supabase
    .from('notes')
    .insert([
      {
        restaurant_id: restaurantId,
        created_by: userId,
        title,
        description,
        category,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error inserting note:', error);
    throw error;
  }
  return data;
};

export const updateNote = async (
  id: string,
  title: string,
  description: string,
  category: string | null
) => {
  const { data, error } = await supabase
    .from('notes')
    .update({ title, description, category, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating note:', error);
    throw error;
  }
  return data;
};

export const deleteNote = async (id: string) => {
  const { error } = await supabase.from('notes').delete().eq('id', id);
  if (error) {
    console.error('Error deleting note:', error);
    throw error;
  }
};
