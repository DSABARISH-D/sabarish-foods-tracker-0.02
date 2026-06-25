import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setLocale } from '@/lib/i18n';
import {
  CashBalance,
  CashBalanceUpdate,
  DashboardState,
  Expense,
  ExpenseForm,
  InventoryRecord,
  Kadan,
  KadanForm,
  Language,
  Sale,
  SaleForm,
  Theme,
  User,
} from '@/types';
import {
  signInWithEmail,
  signOutUser,
  getSession,
  getUserProfile,
  fetchDashboardStats,
  fetchSales,
  insertSale,
  deleteSale,
  fetchExpenses,
  insertExpense,
  deleteExpense,
  lockExpensesForDate,
  checkDayLocked,
  fetchInventory,
  upsertInventoryItem,
  fetchCashBalance,
  updateCashBalance,
  fetchKadan,
  insertKadan,
  updateKadan,
  deleteKadan,
  markKadanPaid,
} from '@/services/supabase.service';
import { syncSaleToSheets, syncExpenseToSheets } from '@/services/sheets.service';
import { getTodayDate } from '@/lib/utils';

// ── Sync Status Type ──────────────────────────────────────────────────
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

// ── Auth Store ────────────────────────────────────────────────────────
interface AuthStore {
  user: User | null;
  isLoading: boolean;
  _hasHydrated: boolean;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: true,
  _hasHydrated: false,

  initialize: async () => {
    try {
      const session = await getSession();
      if (session?.user) {
        const profile = await getUserProfile(session.user.id);
        set({ user: profile ?? ({ id: session.user.id, email: session.user.email ?? '' } as User) });
      }
    } catch {
      set({ user: null });
    } finally {
      set({ isLoading: false, _hasHydrated: true });
    }
  },

  signIn: async (email, password) => {
    set({ isLoading: true });
    try {
      const { user } = await signInWithEmail(email, password);
      if (user) {
        const profile = await getUserProfile(user.id);
        set({ user: profile ?? ({ id: user.id, email: user.email ?? '' } as User) });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    await signOutUser();
    set({ user: null });
  },
}));

// ── Dashboard Store ───────────────────────────────────────────────────
interface DashboardStore extends DashboardState {
  loadStats: (date?: string) => Promise<void>;
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  stats: null,
  statsLoading: false,

  loadStats: async (date?: string) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    set({ statsLoading: true });
    try {
      const stats = await fetchDashboardStats(user.id, date);
      set({ stats });
    } catch {
      // Keep existing stats silently
    } finally {
      set({ statsLoading: false });
    }
  },
}));

// ── Sync Store (global sync status) ──────────────────────────────────
interface SyncStore {
  syncStatus: SyncStatus;
  syncError: string | null;
  lastSyncedAt: string | null;
  setSyncing: () => void;
  setSyncSuccess: () => void;
  setSyncError: (error: string) => void;
  resetSync: () => void;
}

export const useSyncStore = create<SyncStore>((set) => ({
  syncStatus: 'idle',
  syncError: null,
  lastSyncedAt: null,

  setSyncing: () => set({ syncStatus: 'syncing', syncError: null }),
  setSyncSuccess: () =>
    set({ syncStatus: 'success', syncError: null, lastSyncedAt: new Date().toISOString() }),
  setSyncError: (error: string) => set({ syncStatus: 'error', syncError: error }),
  resetSync: () => set({ syncStatus: 'idle', syncError: null }),
}));

// ── Sales Store ───────────────────────────────────────────────────────
interface SalesStore {
  sales: Sale[];
  salesLoading: boolean;
  loadSales: (date?: string) => Promise<void>;
  addSale: (form: SaleForm) => Promise<void>;
  removeSale: (id: string) => Promise<void>;
}

export const useSalesStore = create<SalesStore>((set) => ({
  sales: [],
  salesLoading: false,

  loadSales: async (date?: string) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    set({ salesLoading: true });
    try {
      const sales = await fetchSales(user.id, date);
      set({ sales });
    } finally {
      set({ salesLoading: false });
    }
  },

  addSale: async (form: SaleForm) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    // 1. Save to Supabase
    const sale = await insertSale(user.id, form);
    set((s) => ({ sales: [sale, ...s.sales] }));
    useDashboardStore.getState().loadStats();

    // 2. Direct sync to Google Sheets
    useSyncStore.getState().setSyncing();
    const result = await syncSaleToSheets(sale);
    if (result.success) {
      useSyncStore.getState().setSyncSuccess();
    } else {
      useSyncStore.getState().setSyncError(result.error ?? 'Sheets sync failed');
    }
  },

  removeSale: async (id: string) => {
    await deleteSale(id);
    set((s) => ({ sales: s.sales.filter((x) => x.id !== id) }));
    useDashboardStore.getState().loadStats();
  },
}));

// ── Expenses Store ────────────────────────────────────────────────────
interface ExpensesStore {
  expenses: Expense[];
  expensesLoading: boolean;
  isDayLocked: boolean;
  loadExpenses: (date?: string) => Promise<void>;
  checkDayLocked: (date: string) => Promise<void>;
  addExpense: (form: ExpenseForm) => Promise<void>;
  removeExpense: (id: string) => Promise<void>;
  lockDay: (date: string) => Promise<void>;
}

export const useExpensesStore = create<ExpensesStore>((set) => ({
  expenses: [],
  expensesLoading: false,
  isDayLocked: false,

  loadExpenses: async (date?: string) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    set({ expensesLoading: true });
    try {
      const expenses = await fetchExpenses(user.id, date);
      set({ expenses });
    } finally {
      set({ expensesLoading: false });
    }
  },

  checkDayLocked: async (date: string) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const locked = await checkDayLocked(user.id, date);
    set({ isDayLocked: locked });
  },

  addExpense: async (form: ExpenseForm) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    // 1. Save to Supabase
    const expense = await insertExpense(user.id, form);
    set((s) => ({ expenses: [expense, ...s.expenses] }));
    useDashboardStore.getState().loadStats();

    // 2. Direct sync to Google Sheets
    useSyncStore.getState().setSyncing();
    const result = await syncExpenseToSheets(expense);
    if (result.success) {
      useSyncStore.getState().setSyncSuccess();
    } else {
      useSyncStore.getState().setSyncError(result.error ?? 'Sheets sync failed');
    }
  },

  removeExpense: async (id: string) => {
    await deleteExpense(id);
    set((s) => ({ expenses: s.expenses.filter((x) => x.id !== id) }));
    useDashboardStore.getState().loadStats();
  },

  lockDay: async (date: string) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    await lockExpensesForDate(user.id, date);
    set({ isDayLocked: true });
    set((s) => ({ expenses: s.expenses.map((e) => ({ ...e, locked: true })) }));
  },
}));

// ── Kadan Store ───────────────────────────────────────────────────────
interface KadanStore {
  kadanList: Kadan[];
  kadanLoading: boolean;
  loadKadan: () => Promise<void>;
  addKadan: (form: KadanForm) => Promise<void>;
  editKadan: (id: string, updates: Partial<KadanForm>) => Promise<void>;
  removeKadan: (id: string) => Promise<void>;
  markPaid: (id: string) => Promise<void>;
}

export const useKadanStore = create<KadanStore>((set) => ({
  kadanList: [],
  kadanLoading: false,

  loadKadan: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    set({ kadanLoading: true });
    try {
      const list = await fetchKadan(user.id);
      set({ kadanList: list });
    } finally {
      set({ kadanLoading: false });
    }
  },

  addKadan: async (form: KadanForm) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const kadan = await insertKadan(user.id, form);
    set((s) => ({ kadanList: [kadan, ...s.kadanList] }));
  },

  editKadan: async (id: string, updates: Partial<KadanForm>) => {
    await updateKadan(id, updates);
    set((s) => ({
      kadanList: s.kadanList.map((k) => (k.id === id ? { ...k, ...updates } : k)),
    }));
  },

  removeKadan: async (id: string) => {
    await deleteKadan(id);
    set((s) => ({ kadanList: s.kadanList.filter((k) => k.id !== id) }));
  },

  markPaid: async (id: string) => {
    await markKadanPaid(id);
    set((s) => ({
      kadanList: s.kadanList.map((k) =>
        k.id === id ? { ...k, status: 'paid', paid_date: getTodayDate() } : k
      ),
    }));
  },
}));

// ── Inventory Store ───────────────────────────────────────────────────
interface InventoryStore {
  inventory: InventoryRecord[];
  lowStockItems: InventoryRecord[];
  inventoryLoading: boolean;
  loadInventory: () => Promise<void>;
  updateStock: (id: string, quantity: number) => Promise<void>;
}

export const useInventoryStore = create<InventoryStore>((set) => ({
  inventory: [],
  lowStockItems: [],
  inventoryLoading: false,

  loadInventory: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    set({ inventoryLoading: true });
    try {
      const inventory = await fetchInventory(user.id);
      const lowStockItems = inventory.filter((i) => i.quantity <= i.low_stock_threshold);
      set({ inventory, lowStockItems });
    } finally {
      set({ inventoryLoading: false });
    }
  },

  updateStock: async (id: string, quantity: number) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const item = useInventoryStore.getState().inventory.find((i) => i.id === id);
    if (!item) return;
    await upsertInventoryItem(user.id, item.item_name, quantity);
    set((s) => {
      const inventory = s.inventory.map((i) =>
        i.id === id ? { ...i, quantity, last_updated: new Date().toISOString() } : i
      );
      const lowStockItems = inventory.filter((i) => i.quantity <= i.low_stock_threshold);
      return { inventory, lowStockItems };
    });
  },
}));

// ── Cash Store ────────────────────────────────────────────────────────
interface CashStore {
  cashBalance: CashBalance | null;
  cashLoading: boolean;
  loadCash: (date?: string) => Promise<void>;
  updateCash: (updates: CashBalanceUpdate, date?: string) => Promise<void>;
}

export const useCashStore = create<CashStore>((set) => ({
  cashBalance: null,
  cashLoading: false,

  loadCash: async (date?: string) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    set({ cashLoading: true });
    try {
      const cash = await fetchCashBalance(user.id, date);
      set({ cashBalance: cash as CashBalance | null });
    } finally {
      set({ cashLoading: false });
    }
  },

  updateCash: async (updates: CashBalanceUpdate, date?: string) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    await updateCashBalance(user.id, updates, date);
    
    // Refresh the cash store and dashboard stats for the specific date
    await useCashStore.getState().loadCash(date);
    await useDashboardStore.getState().loadStats(date);
  },
}));

// ── UI Store ──────────────────────────────────────────────────────────
const LANGUAGE_KEY = '@sabarish_language';
const THEME_KEY = '@sabarish_theme';

interface UIStore {
  language: Language;
  theme: Theme;
  setLanguage: (lang: Language) => Promise<void>;
  setTheme: (theme: Theme) => Promise<void>;
}

export const useUIStore = create<UIStore>((set) => ({
  language: 'ta',
  theme: 'light',

  setLanguage: async (lang: Language) => {
    setLocale(lang);
    set({ language: lang });
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  },

  setTheme: async (theme: Theme) => {
    set({ theme });
    await AsyncStorage.setItem(THEME_KEY, theme);
  },
}));

// ── Init Preferences from AsyncStorage ───────────────────────────────
export async function initUIPreferences() {
  try {
    const [lang, theme] = await Promise.all([
      AsyncStorage.getItem(LANGUAGE_KEY),
      AsyncStorage.getItem(THEME_KEY),
    ]);
    if (lang === 'ta' || lang === 'en') {
      setLocale(lang);
      useUIStore.setState({ language: lang });
    }
    if (theme === 'light' || theme === 'dark') {
      useUIStore.setState({ theme });
    }
  } catch {
    // Use defaults
  }
}
