import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setLocale } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import {
  CashBalance,
  CashBalanceUpdate,
  DashboardState,
  Expense,
  ExpenseForm,
  ExpenseItem,
  InventoryRecord,
  Kadan,
  KadanForm,
  Language,
  Sale,
  SaleForm,
  Theme,
  User,
  Staff,
  StaffPermissions,
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
  fetchExpenseItems,
  insertExpenseItem,
  fetchInventory,
  upsertInventoryItem,
  fetchCashBalance,
  updateCashBalance,
  fetchKadan,
  insertKadan,
  updateKadan,
  deleteKadan,
  markKadanPaid,
  updateExpensePaymentStatus,
  updateInventoryStockFull,
  fetchDailyTotalsForSync,
} from '@/services/supabase.service';
import {
  gsSyncDailyTotals,
  initGoogleSheetSync,
  startNetworkMonitor,
  stopNetworkMonitor,
  subscribeSyncState,
  getSyncState,
  processQueue,
  checkConnection,
  clearQueue,
  type SyncState,
  type ConnectionStatus,
} from '@/services/googleSheet.service';
import { getTodayDate } from '@/lib/utils';

// ── Sync Status Type ──────────────────────────────────────────────────
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

// ── Auth Store ────────────────────────────────────────────────────────
interface AuthStore {
  user: User | null;
  currentUser: any | null;
  activeStaff: Staff | null;
  activePermissions: StaffPermissions | null;
  isLoading: boolean;
  _hasHydrated: boolean;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  switchStaff: (mpin: string) => Promise<boolean>;
  loginWithMpin: (mpin: string) => Promise<{ success: boolean; forceChangePin?: boolean; user?: any; error?: string }>;
  completeFirstLogin: (userId: string, newMpin: string) => Promise<{ success: boolean; error?: string }>;
  logoutStaff: () => void;
}

// Simple deterministic hash for MPIN compatibility
async function hashMpin(mpin: string): Promise<string> {
  let hash = 0;
  const salt = 'sabarish_foods_2026';
  const salted = salt + mpin + salt;
  for (let i = 0; i < salted.length; i++) {
    const char = salted.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  let result = Math.abs(hash).toString(36);
  for (let round = 0; round < 3; round++) {
    let h = 0;
    const input = result + mpin + round.toString();
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      h = ((h << 5) - h) + char;
      h = h & h;
    }
    result += Math.abs(h).toString(36);
  }
  return `shash$${result}`;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  currentUser: null,
  activeStaff: null,
  activePermissions: null,
  isLoading: true,
  _hasHydrated: false,

  initialize: async () => {
    set({ isLoading: true });
    try {
      // 1. Silent Auth Sign In (Shared background session for RLS to work)
      let session = await getSession();
      if (!session?.user) {
        try {
          const authRes = await signInWithEmail('sabarishfoods@gmail.com', '091230');
          session = { user: authRes.user } as any;
        } catch {
          // Account doesn't exist, sign up
          const signUpRes = await supabase.auth.signUp({
            email: 'sabarishfoods@gmail.com',
            password: '091230',
          });
          session = { user: signUpRes.data.user } as any;
        }
      }

      if (session?.user) {
        // Logged into Supabase Auth
        // Now check if owner profile exists in users table
        const { data: ownerProfile } = await supabase
          .from('users')
          .select('*')
          .eq('role', 'owner')
          .limit(1);

        let owner = ownerProfile?.[0];

        if (!owner) {
          // Create default owner account
          const defaultMpinHash = await hashMpin('0909');
          const { data: newOwner } = await supabase
            .from('users')
            .insert({
              id: session.user.id,
              email: 'sabarishfoods@gmail.com',
              full_name: 'Sabarish',
              role: 'owner',
              mpin_hash: defaultMpinHash,
              status: 'active',
              first_login_completed: false,
            })
            .select()
            .single();

          if (newOwner) {
            owner = newOwner;
            // Insert default owner permissions
            await supabase.from('permissions').insert({
              user_id: newOwner.id,
              dashboard: true,
              expenses: true,
              inventory: true,
              credit: true,
              reports: true,
              settings: true,
            });
          }
        }

        // Save session user
        set({ user: owner ?? ({ id: session.user.id, email: session.user.email ?? '' } as User) });

        // Restore logged in user session from AsyncStorage
        const cachedUserStr = await AsyncStorage.getItem('@sabarish_current_user');
        const cachedStaffStr = await AsyncStorage.getItem('@sabarish_active_staff');
        const cachedPermsStr = await AsyncStorage.getItem('@sabarish_active_perms');

        if (cachedUserStr) {
          const cachedUser = JSON.parse(cachedUserStr);
          set({
            currentUser: cachedUser,
            activeStaff: cachedStaffStr ? JSON.parse(cachedStaffStr) : null,
            activePermissions: cachedPermsStr ? JSON.parse(cachedPermsStr) : null,
          });
        }
      }
    } catch (e) {
      console.error('Initialize error:', e);
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
        const u = profile ?? ({ id: user.id, email: user.email ?? '' } as User);
        set({ user: u, currentUser: u });
        set({ activeStaff: null, activePermissions: null });
        await AsyncStorage.setItem('@sabarish_current_user', JSON.stringify(u));
        await AsyncStorage.removeItem('@sabarish_active_staff');
        await AsyncStorage.removeItem('@sabarish_active_perms');
      }
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    const currentUser = get().currentUser;
    if (currentUser) {
      try {
        const { data } = await supabase
          .from('login_history')
          .select('id')
          .eq('user_id', currentUser.id)
          .is('logout_time', null)
          .order('created_at', { ascending: false })
          .limit(1);

        if (data && data.length > 0) {
          const nowStr = new Date().toLocaleTimeString('en-US', { hour12: false });
          await supabase
            .from('login_history')
            .update({ logout_time: nowStr })
            .eq('id', data[0].id);
        }
      } catch (e) {
        console.error('Logout logging failed', e);
      }
    }

    set({ currentUser: null, activeStaff: null, activePermissions: null });
    await AsyncStorage.removeItem('@sabarish_current_user');
    await AsyncStorage.removeItem('@sabarish_active_staff');
    await AsyncStorage.removeItem('@sabarish_active_perms');
  },

  loginWithMpin: async (mpin: string) => {
    set({ isLoading: true });
    try {
      const mpinHash = await hashMpin(mpin);
      
      // Query users table for matching MPIN
      const { data: matchedUsers, error } = await supabase
        .from('users')
        .select('*')
        .eq('mpin_hash', mpinHash)
        .eq('status', 'active');

      if (error || !matchedUsers || matchedUsers.length === 0) {
        set({ isLoading: false });
        return { success: false, error: 'Invalid MPIN' };
      }

      const loggedUser = matchedUsers[0];

      // If it is default owner first login, return first login status
      if (loggedUser.role === 'owner' && !loggedUser.first_login_completed && mpin === '0909') {
        set({ isLoading: false });
        return { success: true, forceChangePin: true, user: loggedUser };
      }

      // Load permissions
      let permissions = null;
      if (loggedUser.role === 'staff') {
        const { data: permsData } = await supabase
          .from('permissions')
          .select('*')
          .eq('staff_id', loggedUser.id)
          .single();
        if (permsData) {
          permissions = {
            id: permsData.id,
            staff_id: permsData.staff_id,
            owner_id: permsData.owner_id,
            dashboard: permsData.dashboard,
            expenses: permsData.expenses,
            inventory: permsData.inventory,
            credit: permsData.credit,
            reports: permsData.reports,
            settings: permsData.settings,
            notes: permsData.notes || false,
            created_at: permsData.created_at,
            updated_at: permsData.updated_at,
          };
        }
      } else {
        // Owner has full permissions
        permissions = {
          id: 'owner-perms',
          staff_id: loggedUser.id,
          owner_id: loggedUser.id,
          dashboard: true,
          expenses: true,
          inventory: true,
          credit: true,
          reports: true,
          settings: true,
          notes: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      // Record login history
      await supabase.from('login_history').insert({
        user_id: loggedUser.id,
        user_name: loggedUser.full_name,
        user_type: loggedUser.role,
      });

      // Update state
      set({
        currentUser: loggedUser,
        activeStaff: loggedUser.role === 'staff' ? loggedUser : null,
        activePermissions: permissions,
      });

      // Save to AsyncStorage
      await AsyncStorage.setItem('@sabarish_current_user', JSON.stringify(loggedUser));
      if (loggedUser.role === 'staff') {
        await AsyncStorage.setItem('@sabarish_active_staff', JSON.stringify(loggedUser));
        await AsyncStorage.setItem('@sabarish_active_perms', JSON.stringify(permissions));
      } else {
        await AsyncStorage.removeItem('@sabarish_active_staff');
        await AsyncStorage.removeItem('@sabarish_active_perms');
      }

      set({ isLoading: false });
      return { success: true, forceChangePin: false };
    } catch (e: any) {
      set({ isLoading: false });
      return { success: false, error: e.message || 'Login failed' };
    }
  },

  completeFirstLogin: async (userId: string, newMpin: string) => {
    set({ isLoading: true });
    try {
      const newMpinHash = await hashMpin(newMpin);
      const { data: updatedUser, error } = await supabase
        .from('users')
        .update({
          mpin_hash: newMpinHash,
          first_login_completed: true,
        })
        .eq('id', userId)
        .select()
        .single();

      if (error || !updatedUser) {
        set({ isLoading: false });
        return { success: false, error: 'Failed to update MPIN' };
      }

      // Owner permissions
      const permissions = {
        id: 'owner-perms',
        staff_id: updatedUser.id,
        owner_id: updatedUser.id,
        dashboard: true,
        expenses: true,
        inventory: true,
        credit: true,
        reports: true,
        settings: true,
        notes: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Record login history
      await supabase.from('login_history').insert({
        user_id: updatedUser.id,
        user_name: updatedUser.full_name,
        user_type: 'owner',
      });

      // Update state
      set({
        currentUser: updatedUser,
        activeStaff: null,
        activePermissions: permissions,
      });

      // Save to AsyncStorage
      await AsyncStorage.setItem('@sabarish_current_user', JSON.stringify(updatedUser));
      await AsyncStorage.removeItem('@sabarish_active_staff');
      await AsyncStorage.removeItem('@sabarish_active_perms');

      set({ isLoading: false });
      return { success: true };
    } catch (e: any) {
      set({ isLoading: false });
      return { success: false, error: e.message || 'Operation failed' };
    }
  },

  switchStaff: async (mpin: string) => {
    const owner = get().user;
    if (!owner) return false;
    
    try {
      const mpinHash = await hashMpin(mpin);
      
      // Query users table for matching MPIN
      const { data: userList, error } = await supabase
        .from('users')
        .select('*')
        .eq('mpin_hash', mpinHash)
        .eq('status', 'active');
        
      if (error || !userList || userList.length === 0) {
        return false;
      }
      
      const matchedUser = userList[0];
      
      if (matchedUser.role === 'owner') {
        // Switch to Owner Mode
        set({ currentUser: matchedUser, activeStaff: null, activePermissions: null });
        await AsyncStorage.setItem('@sabarish_current_user', JSON.stringify(matchedUser));
        await AsyncStorage.removeItem('@sabarish_active_staff');
        await AsyncStorage.removeItem('@sabarish_active_perms');
        
        // Log history
        await supabase.from('login_history').insert({
          user_id: matchedUser.id,
          user_name: matchedUser.full_name,
          user_type: 'owner',
        });
        
        return true;
      } else {
        // Load permissions
        const { data: permsData } = await supabase
          .from('permissions')
          .select('*')
          .eq('user_id', matchedUser.id)
          .single();
          
        const permissions = permsData as StaffPermissions;
        
        set({ currentUser: matchedUser, activeStaff: matchedUser, activePermissions: permissions });
        await AsyncStorage.setItem('@sabarish_current_user', JSON.stringify(matchedUser));
        await AsyncStorage.setItem('@sabarish_active_staff', JSON.stringify(matchedUser));
        await AsyncStorage.setItem('@sabarish_active_perms', JSON.stringify(permissions));
        
        // Log history
        await supabase.from('login_history').insert({
          user_id: matchedUser.id,
          user_name: matchedUser.full_name,
          user_type: 'staff',
        });
        
        return true;
      }
    } catch {
      return false;
    }
  },

  logoutStaff: () => {
    set({ currentUser: null, activeStaff: null, activePermissions: null });
    AsyncStorage.removeItem('@sabarish_current_user');
    AsyncStorage.removeItem('@sabarish_active_staff');
    AsyncStorage.removeItem('@sabarish_active_perms');
  },
}));

// ── Date Store ────────────────────────────────────────────────────────
interface DateStore {
  businessDate: string;
  setBusinessDate: (date: string) => void;
}

export const useDateStore = create<DateStore>((set) => ({
  businessDate: getTodayDate(),
  setBusinessDate: (date: string) => set({ businessDate: date }),
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

// ── Sync Store (Google Sheet sync status) ────────────────────────────
interface SyncStore {
  syncStatus: SyncStatus;
  connectionStatus: ConnectionStatus;
  syncError: string | null;
  lastSyncedAt: string | null;
  pendingCount: number;
  initialize: () => void;
  setSyncing: () => void;
  setSyncSuccess: () => void;
  setSyncError: (error: string) => void;
  resetSync: () => void;
  checkGoogleSheetsConnection: () => Promise<{ connected: boolean; message: string }>;
  retryPending: () => Promise<void>;
  clearPending: () => Promise<void>;
  destroy: () => void;
}

export const useSyncStore = create<SyncStore>((set, get) => {
  let unsubscribeSyncState: (() => void) | null = null;

  return {
    syncStatus: 'idle',
    connectionStatus: 'unconfigured',
    syncError: null,
    lastSyncedAt: null,
    pendingCount: 0,

    initialize: () => {
      // Subscribe to sync state changes from the service
      unsubscribeSyncState = subscribeSyncState((state: SyncState) => {
        set({
          connectionStatus: state.status,
          lastSyncedAt: state.lastSyncTime,
          pendingCount: state.pendingCount,
          syncError: state.lastError,
          syncStatus: state.status === 'syncing' ? 'syncing'
            : state.status === 'connected' ? 'success'
            : state.status === 'failed' ? 'error'
            : 'idle',
        });
      });

      // Initialize the service and start network monitoring
      initGoogleSheetSync();
      startNetworkMonitor();
    },

    destroy: () => {
      if (unsubscribeSyncState) {
        unsubscribeSyncState();
        unsubscribeSyncState = null;
      }
      stopNetworkMonitor();
    },

    setSyncing: () => set({ syncStatus: 'syncing', syncError: null }),
    setSyncSuccess: () =>
      set({ syncStatus: 'success', syncError: null, lastSyncedAt: new Date().toISOString() }),
    setSyncError: (error: string) => set({ syncStatus: 'error', syncError: error }),
    resetSync: () => set({ syncStatus: 'idle', syncError: null }),

    checkGoogleSheetsConnection: async () => {
      return checkConnection();
    },

    retryPending: async () => {
      await processQueue();
    },

    clearPending: async () => {
      await clearQueue();
      set({ pendingCount: 0 });
    },
  };
});

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

    // 1. Save to Supabase (primary database)
    const sale = await insertSale(user.id, form);
    set((s) => ({ sales: [sale, ...s.sales] }));
    useDashboardStore.getState().loadStats();

    // 2. Sync to Google Sheets via Apps Script (with offline queue)
    fetchDailyTotalsForSync(user.id, form.date).then(totals => {
      gsSyncDailyTotals(totals, form.date, 'CREATE').catch(() => {});
    }).catch(console.error);
  },

  removeSale: async (id: string) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const sale = useSalesStore.getState().sales.find((x) => x.id === id);
    if (sale) {
      fetchDailyTotalsForSync(user.id, sale.date).then(totals => {
        gsSyncDailyTotals(totals, sale.date, 'DELETE').catch(() => {});
      }).catch(console.error);
    }

    await deleteSale(id);
    set((s) => ({ sales: s.sales.filter((x) => x.id !== id) }));
    useDashboardStore.getState().loadStats();
  },
}));

function matchTrackedInventoryItem(purchaseItemName: string, inventoryList: any[]): string | null {
  const name = purchaseItemName.toLowerCase().trim();
  if (name === 'rice') return 'rice';
  if (name === 'masala' || name === 'masalas') return 'masala';
  if (name === 'chicken') return 'chicken';
  if (name === 'cooking oil' || name === 'oil') return 'oil';
  if (name === 'gas' || name === 'gas cylinder' || name === 'gas cylinders') return 'gas';
  
  const customMatch = inventoryList.find(i => i.item_name.toLowerCase() === name);
  if (customMatch) return customMatch.item_name;
  
  return null;
}

function parsePurchaseItems(description?: string): { name: string, quantity: number }[] {
  const items: { name: string, quantity: number }[] = [];
  if (!description) return items;
  const lines = description.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    const nextLine = lines[i+1].trim();
    if (nextLine.includes('×') || nextLine.includes('x')) {
      const parts = nextLine.split(/[×x]/);
      if (parts.length > 0) {
        const qty = parseFloat(parts[0].trim()) || 0;
        if (line && qty > 0) {
          items.push({ name: line, quantity: qty });
        }
      }
    }
  }
  return items;
}

// ── Expenses Store ────────────────────────────────────────────────────
interface ExpensesStore {
  expenses: Expense[];
  expensesLoading: boolean;
  isDayLocked: boolean;
  expenseItems: ExpenseItem[];
  loadExpenses: (date?: string) => Promise<void>;
  loadExpenseItems: () => Promise<void>;
  checkDayLocked: (date: string) => Promise<void>;
  addExpense: (form: ExpenseForm, items?: any[]) => Promise<void>;
  addExpenseItem: (name: string, category: string) => Promise<void>;
  removeExpense: (id: string) => Promise<void>;
  lockDay: (date: string) => Promise<void>;
  markExpensePaid: (id: string) => Promise<void>;
}

export const useExpensesStore = create<ExpensesStore>((set) => ({
  expenses: [],
  expenseItems: [],
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

  loadExpenseItems: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    try {
      const items = await fetchExpenseItems(user.id);
      set({ expenseItems: items });
    } catch (e) {
      console.error('Failed to load expense items:', e);
    }
  },

  checkDayLocked: async (date: string) => {
    set({ isDayLocked: false });
  },

  addExpenseItem: async (name: string, category: string) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    try {
      const newItem = await insertExpenseItem(user.id, name, category);
      set((state) => ({ expenseItems: [...state.expenseItems, newItem] }));
    } catch (e) {
      console.error('Failed to add expense item:', e);
    }
  },

  addExpense: async (form: ExpenseForm, items?: any[]) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    // 1. Save to Supabase (primary database)
    const expense = await insertExpense(user.id, form);
    set((s) => ({ expenses: [expense, ...s.expenses] }));
    useDashboardStore.getState().loadStats();

    // 2. Sync to Google Sheets via Apps Script (with offline queue)
    fetchDailyTotalsForSync(user.id, form.date).then(totals => {
      gsSyncDailyTotals(totals, form.date, 'CREATE').catch(() => {});
    }).catch(console.error);

    // 3. Update Inventory automatically
    try {
      let inventoryList = useInventoryStore.getState().inventory;
      if (inventoryList.length === 0) {
        await useInventoryStore.getState().loadInventory();
        inventoryList = useInventoryStore.getState().inventory;
      }

      if (expense.category === 'chicken_cost' && expense.chicken_kg) {
        await updateInventoryStockFull(
          user.id,
          'chicken',
          Number(expense.chicken_kg),
          Number(expense.chicken_price_per_kg || 0),
          expense.payment_status || 'Paid',
          expense.date
        );
      } else if (expense.category === 'gas_cylinder') {
        await updateInventoryStockFull(
          user.id,
          'gas',
          1,
          expense.amount,
          expense.payment_status || 'Paid',
          expense.date
        );
      } else if (expense.category === 'store_purchases' && items) {
        for (const item of items) {
          const matchedName = matchTrackedInventoryItem(item.name, inventoryList);
          if (matchedName) {
            const qty = parseFloat(item.quantity) || 0;
            const price = parseFloat(item.price) || 0;
            const status = item.paymentStatus || 'Paid';
            await updateInventoryStockFull(
              user.id,
              matchedName,
              qty,
              price,
              status,
              expense.date
            );
          }
        }
      }
      
      // Reload inventory store in the background
      await useInventoryStore.getState().loadInventory();
    } catch (err) {
      console.error('Failed to auto-update inventory:', err);
    }
  },

  removeExpense: async (id: string) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    // Find the expense to get details before deleting
    const expense = useExpensesStore.getState().expenses.find((x) => x.id === id);

    try {
      if (expense) {
        let inventoryList = useInventoryStore.getState().inventory;
        if (inventoryList.length === 0) {
          await useInventoryStore.getState().loadInventory();
          inventoryList = useInventoryStore.getState().inventory;
        }

        if (expense.category === 'chicken_cost' && expense.chicken_kg) {
          // Subtract the chicken kg
          await updateInventoryStockFull(
            user.id,
            'chicken',
            -Number(expense.chicken_kg),
            Number(expense.chicken_price_per_kg || 0),
            'Paid',
            expense.date
          );
        } else if (expense.category === 'gas_cylinder') {
          // Subtract 1 cylinder
          await updateInventoryStockFull(
            user.id,
            'gas',
            -1,
            expense.amount,
            'Paid',
            expense.date
          );
        } else if (expense.category === 'store_purchases') {
          // Parse the items from description
          const items = parsePurchaseItems(expense.description);
          for (const item of items) {
            const matchedName = matchTrackedInventoryItem(item.name, inventoryList);
            if (matchedName) {
              const qty = item.quantity;
              const invItem = inventoryList.find(i => i.item_name === matchedName);
              await updateInventoryStockFull(
                user.id,
                matchedName,
                -qty,
                invItem?.last_purchase_price || 0,
                invItem?.payment_status || 'Paid',
                expense.date
              );
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to update inventory on expense deletion:', err);
    }

    if (expense) {
      fetchDailyTotalsForSync(user.id, expense.date).then(totals => {
        gsSyncDailyTotals(totals, expense.date, 'DELETE').catch(() => {});
      }).catch(console.error);
    }

    await deleteExpense(id);
    set((s) => ({ expenses: s.expenses.filter((x) => x.id !== id) }));
    useDashboardStore.getState().loadStats();
    
    // Reload inventory immediately
    await useInventoryStore.getState().loadInventory();
  },

  lockDay: async (date: string) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    await lockExpensesForDate(user.id, date);
    set({ isDayLocked: true });
    set((s) => ({ expenses: s.expenses.map((e) => ({ ...e, locked: true })) }));
  },

  markExpensePaid: async (id: string) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    
    const businessDate = useDateStore.getState().businessDate;
    
    // Update local state first to be responsive
    set((s) => ({
      expenses: s.expenses.map((e) =>
        e.id === id ? { ...e, payment_status: 'Paid', paid_date: businessDate } : e
      ),
    }));

    // Update in Supabase
    await updateExpensePaymentStatus(id, 'Paid', businessDate);
    useDashboardStore.getState().loadStats();

    // Get the updated expense record
    const expense = useExpensesStore.getState().expenses.find((e) => e.id === id);
    if (expense) {
      // Sync to Google Sheets: pass category, date, payment_status: 'Paid', but NO amount (avoid double counting)
      fetchDailyTotalsForSync(user.id, expense.date).then(totals => {
        gsSyncDailyTotals(totals, expense.date, 'UPDATE').catch(() => {});
      }).catch(console.error);

      // Update payment status in inventory if it is a tracked item
      try {
        let inventoryList = useInventoryStore.getState().inventory;
        if (inventoryList.length === 0) {
          await useInventoryStore.getState().loadInventory();
          inventoryList = useInventoryStore.getState().inventory;
        }

        let matchedName: string | null = null;
        if (expense.description) {
          if (expense.description.toLowerCase().includes('rice')) {
            matchedName = 'rice';
          } else {
            for (const item of inventoryList) {
              if (expense.description.toLowerCase().includes(item.item_name.toLowerCase())) {
                matchedName = item.item_name;
                break;
              }
            }
          }
        }
        if (matchedName) {
          const invItem = inventoryList.find(i => i.item_name === matchedName);
          await updateInventoryStockFull(
            user.id,
            matchedName,
            0,
            invItem?.last_purchase_price || 0,
            'Paid',
            expense.date
          );
          await useInventoryStore.getState().loadInventory();
        }
      } catch (err) {
        console.error('Failed to update inventory payment status:', err);
      }
    }
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

    const businessDate = useDateStore.getState().businessDate;

    // Sync credit (kadan) to Google Sheets
    fetchDailyTotalsForSync(user.id, businessDate).then(totals => {
      gsSyncDailyTotals(totals, businessDate, 'CREATE').catch(() => {});
    }).catch(console.error);
  },

  editKadan: async (id: string, updates: Partial<KadanForm>) => {
    await updateKadan(id, updates);
    set((s) => ({
      kadanList: s.kadanList.map((k) => (k.id === id ? { ...k, ...updates } : k)),
    }));
  },

  removeKadan: async (id: string) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const kadan = useKadanStore.getState().kadanList.find((k) => k.id === id);
    if (kadan) {
      const date = kadan.created_at ? kadan.created_at.split('T')[0] : useDateStore.getState().businessDate;
      fetchDailyTotalsForSync(user.id, date).then(totals => {
        gsSyncDailyTotals(totals, date, 'DELETE').catch(() => {});
      }).catch(console.error);
    }
    await deleteKadan(id);
    set((s) => ({ kadanList: s.kadanList.filter((k) => k.id !== id) }));
  },

  markPaid: async (id: string) => {
    const businessDate = useDateStore.getState().businessDate;
    await markKadanPaid(id);
    set((s) => ({
      kadanList: s.kadanList.map((k) =>
        k.id === id ? { ...k, status: 'paid', paid_date: businessDate } : k
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
    
    const date = useDateStore.getState().businessDate;
    await upsertInventoryItem(user.id, item.item_name, quantity);
    
    set((s) => {
      const inventory = s.inventory.map((i) =>
        i.id === id ? { ...i, quantity, last_updated: new Date(date).toISOString() } : i
      );
      const lowStockItems = inventory.filter((i) => i.quantity <= i.low_stock_threshold);
      return { inventory, lowStockItems };
    });

    // Sync inventory to Google Sheets
    fetchDailyTotalsForSync(user.id, date).then(totals => {
      gsSyncDailyTotals(totals, date, 'UPDATE').catch(() => {});
    }).catch(console.error);
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

    // Sync cash balance to Google Sheets
    const targetDate = date || getTodayDate();
    fetchDailyTotalsForSync(user.id, targetDate).then(totals => {
      gsSyncDailyTotals(totals, targetDate, 'UPDATE').catch(() => {});
    }).catch(console.error);
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

export * from './notesStore';
