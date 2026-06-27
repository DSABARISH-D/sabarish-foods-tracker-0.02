// ====================================
// SABARISH FOODS — TypeScript Interfaces
// ====================================

export type UserRole = 'owner' | 'staff';
export type Language = 'ta' | 'en';
export type Theme = 'light' | 'dark';
export type PaymentMethod = 'cash' | 'upi' | 'card' | 'credit';
export type SaleCategory = 'rice_meals' | 'noodles' | 'tiffin' | 'beverages' | 'other';
export type ExpenseCategory =
  | 'chicken_cost'
  | 'store_purchases'
  | 'market_purchases'
  | 'indian_market'
  | 'electricity'
  | 'gas_cylinder'
  | 'staff'
  | 'transport'
  | 'other';
export type StaffRole = 'cook' | 'cashier' | 'server' | 'delivery' | 'cleaner' | 'manager' | 'owner' | 'other';
export type StaffStatus = 'active' | 'inactive';
export type KadanStatus = 'pending' | 'paid' | 'overdue';
export type InventoryItem = 'chicken' | 'oil' | 'masala' | 'rice' | 'gas' | 'other';
export type ReportPeriod = 'daily' | 'weekly' | 'monthly';

// ── User ──────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

// ── Sale ──────────────────────────────────────────────────────────────
export interface Sale {
  id: string;
  user_id: string;
  amount: number;
  category: SaleCategory;
  description?: string;
  payment_method: PaymentMethod;
  date: string; // YYYY-MM-DD
  synced_to_sheets: boolean;
  created_at: string;
  updated_at: string;
}

export interface SaleForm {
  amount: number;
  category: SaleCategory;
  description?: string;
  payment_method: PaymentMethod;
  date: string;
}

// ── Expense ───────────────────────────────────────────────────────────
export interface Expense {
  id: string;
  user_id: string;
  category: ExpenseCategory;
  amount: number;
  description?: string;
  date: string;
  chicken_kg?: number;
  chicken_price_per_kg?: number;
  locked: boolean;
  synced_to_sheets: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExpenseForm {
  category: ExpenseCategory;
  amount: number;
  description?: string;
  date: string;
  chicken_kg?: number;
  chicken_price_per_kg?: number;
}

// ── Staff ─────────────────────────────────────────────────────────────
export interface Staff {
  id: string;
  owner_id: string;
  full_name: string;
  phone_number: string;
  role: StaffRole;
  mpin_hash: string;
  monthly_salary: number;
  joining_date: string;
  status: StaffStatus;
  created_at: string;
  updated_at: string;
}

export interface StaffForm {
  full_name: string;
  phone_number: string;
  role: StaffRole;
  mpin: string;
  monthly_salary: number;
  joining_date: string;
  status: StaffStatus;
}

// ── Salary Payment ────────────────────────────────────────────────────
export interface SalaryPayment {
  id: string;
  staff_id: string;
  owner_id: string;
  amount: number;
  salary_month: string;
  paid_date: string;
  expense_id?: string;
  notes?: string;
  created_at: string;
  // Joined data
  staff_name?: string;
}

// ── Login History ─────────────────────────────────────────────────────
export interface LoginHistoryEntry {
  id: string;
  staff_id?: string;
  owner_id: string;
  user_name: string;
  user_type: 'owner' | 'staff';
  login_date: string;
  login_time: string;
  logout_time?: string;
  created_at: string;
}

// ── Staff Permissions ─────────────────────────────────────────────────
export interface StaffPermissions {
  id: string;
  staff_id: string;
  owner_id: string;
  dashboard: boolean;
  expenses: boolean;
  inventory: boolean;
  credit: boolean;
  reports: boolean;
  settings: boolean;
  created_at: string;
  updated_at: string;
}

// ── Attendance ────────────────────────────────────────────────────────
export interface AttendanceRecord {
  id: string;
  staff_id: string;
  owner_id: string;
  date: string;
  status: 'present' | 'absent' | 'half_day' | 'leave';
  created_at: string;
  updated_at: string;
}

// ── Inventory ─────────────────────────────────────────────────────────
export interface InventoryRecord {
  id: string;
  user_id: string;
  item_name: InventoryItem;
  quantity: number;
  unit: string;
  low_stock_threshold: number;
  last_updated: string;
  created_at: string;
  updated_at: string;
}

// ── Cash Balance ──────────────────────────────────────────────────────
export interface CashBalance {
  id: string;
  user_id: string;
  petty_cash: number;
  cash_in_hand: number;
  cash_in_bank: number;
  last_updated: string;
  created_at: string;
  updated_at: string;
}

export interface CashBalanceUpdate {
  petty_cash?: number;
  cash_in_hand?: number;
  cash_in_bank?: number;
}

// ── Kadan (Credit) ────────────────────────────────────────────────────
export interface Kadan {
  id: string;
  user_id: string;
  customer_name: string;
  mobile_number: string;
  amount: number;
  due_date: string;
  notes?: string;
  status: KadanStatus;
  paid_date?: string;
  created_at: string;
  updated_at: string;
}

export interface KadanForm {
  customer_name: string;
  mobile_number: string;
  amount: number;
  due_date: string;
  notes?: string;
}

// ── Dashboard Stats ───────────────────────────────────────────────────
export interface DashboardStats {
  petty_cash: number;
  cash_in_hand: number;
  cash_in_bank: number;
  today_sales: number;
  today_expenses: number;
  today_profit: number;
  monthly_sales: number;
  monthly_expenses: number;
  monthly_profit: number;
}

// ── Report ────────────────────────────────────────────────────────────
export interface ReportDataPoint {
  label: string;
  sales: number;
  expenses: number;
  profit: number;
}

export interface ExpenseCategoryBreakdown {
  category: ExpenseCategory;
  total: number;
  percentage: number;
}

export interface Report {
  period: ReportPeriod;
  total_sales: number;
  total_expenses: number;
  total_profit: number;
  trend_data: ReportDataPoint[];
  expense_breakdown: ExpenseCategoryBreakdown[];
}

// ── Sync Queue ────────────────────────────────────────────────────────
export type SyncType = 'sale' | 'expense';

export interface SyncQueueItem {
  id: string;
  type: SyncType;
  data: Sale | Expense;
  created_at: string;
}

// ── Store State ───────────────────────────────────────────────────────
export interface AuthState {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

export interface DashboardState {
  stats: DashboardStats | null;
  statsLoading: boolean;
  loadStats: () => Promise<void>;
}

export interface SalesState {
  sales: Sale[];
  salesLoading: boolean;
  addSale: (form: SaleForm) => Promise<void>;
  removeSale: (id: string) => Promise<void>;
  loadSales: (date?: string) => Promise<void>;
}

export interface ExpensesState {
  expenses: Expense[];
  expensesLoading: boolean;
  isDayLocked: boolean;
  addExpense: (form: ExpenseForm) => Promise<void>;
  removeExpense: (id: string) => Promise<void>;
  lockDay: (date: string) => Promise<void>;
  loadExpenses: (date?: string) => Promise<void>;
  checkDayLocked: (date: string) => Promise<void>;
}

export interface KadanState {
  kadanList: Kadan[];
  kadanLoading: boolean;
  addKadan: (form: KadanForm) => Promise<void>;
  editKadan: (id: string, updates: Partial<KadanForm>) => Promise<void>;
  removeKadan: (id: string) => Promise<void>;
  markPaid: (id: string) => Promise<void>;
  loadKadan: () => Promise<void>;
}

export interface InventoryState {
  inventory: InventoryRecord[];
  lowStockItems: InventoryRecord[];
  inventoryLoading: boolean;
  updateStock: (id: string, quantity: number) => Promise<void>;
  loadInventory: () => Promise<void>;
}

export interface CashState {
  cashBalance: CashBalance | null;
  cashLoading: boolean;
  updateCash: (updates: CashBalanceUpdate) => Promise<void>;
  loadCash: () => Promise<void>;
}

export interface UIState {
  language: Language;
  theme: Theme;
  isOffline: boolean;
  pendingSyncCount: number;
  setLanguage: (lang: Language) => Promise<void>;
  setTheme: (theme: Theme) => Promise<void>;
  setOffline: (offline: boolean) => void;
  setPendingSyncCount: (count: number) => void;
}
