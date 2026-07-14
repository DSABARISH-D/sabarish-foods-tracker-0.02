import { create } from 'zustand';
import {
  Staff,
  StaffForm,
  SalaryPayment,
  LoginHistoryEntry,
  StaffPermissions,
  AttendanceRecord,
} from '@/types';
import {
  fetchStaff,
  insertStaff,
  updateStaff,
  resetStaffMpin,
  toggleStaffStatus,
  deleteStaff as deleteStaffService,
  fetchSalaryPayments,
  markSalaryPaid,
  getStaffSalarySummary,
  fetchLoginHistory,
  fetchPermissions,
  updatePermissions,
  getStaffDashboardStats,
  fetchAttendance,
  markAttendance,
} from '@/services/staff.service';
import { useAuthStore, useDashboardStore, useExpensesStore, useDateStore } from '@/store';
import { gsLogTransaction } from '@/services/googleSheet.service';
import { fetchDailyTotalsForSync } from '@/services/supabase.service';
import { getTodayDate } from '@/lib/utils';

// ── Staff Store ──────────────────────────────────────────────────────
interface StaffStore {
  staffList: Staff[];
  staffLoading: boolean;
  dashboardStats: { total: number; active: number; inactive: number } | null;
  salaryPayments: SalaryPayment[];
  loginHistory: LoginHistoryEntry[];
  currentPermissions: StaffPermissions | null;
  attendance: Record<string, 'present' | 'absent' | 'half_day' | 'leave'>;
  attendanceLoading: boolean;

  loadStaff: () => Promise<void>;
  loadDashboardStats: () => Promise<void>;
  addStaff: (form: StaffForm) => Promise<void>;
  editStaff: (staffId: string, updates: Partial<Omit<StaffForm, 'mpin'>>) => Promise<void>;
  changeMpin: (staffId: string, newMpin: string) => Promise<void>;
  changeStatus: (staffId: string, status: 'active' | 'inactive') => Promise<void>;
  removeStaff: (staffId: string) => Promise<void>;
  paySalary: (staffId: string, staffName: string, amount: number, salaryMonth: string) => Promise<void>;
  loadSalaryPayments: (staffId?: string) => Promise<void>;
  getSalarySummary: (staffId: string) => Promise<{
    monthly_salary: number;
    total_paid: number;
    pending: number;
    payments: SalaryPayment[];
  }>;
  loadLoginHistory: () => Promise<void>;
  loadPermissions: (staffId: string) => Promise<void>;
  setPermissions: (staffId: string, perms: Partial<Pick<StaffPermissions, 'dashboard' | 'expenses' | 'inventory' | 'credit' | 'reports' | 'settings'>>) => Promise<void>;
  loadAttendance: (date: string) => Promise<void>;
  saveAttendance: (staffId: string, date: string, status: 'present' | 'absent' | 'half_day' | 'leave') => Promise<void>;
}

export const useStaffStore = create<StaffStore>((set, get) => ({
  staffList: [],
  staffLoading: false,
  dashboardStats: null,
  salaryPayments: [],
  loginHistory: [],
  currentPermissions: null,
  attendance: {},
  attendanceLoading: false,

  loadStaff: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    set({ staffLoading: true });
    try {
      const staffList = await fetchStaff(user.id);
      set({ staffList });
    } finally {
      set({ staffLoading: false });
    }
  },

  loadDashboardStats: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    try {
      const stats = await getStaffDashboardStats(user.id);
      set({ dashboardStats: stats });
    } catch {
      // Keep existing stats silently
    }
  },

  addStaff: async (form: StaffForm) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const staff = await insertStaff(user.id, form);
    set((s) => ({ staffList: [staff, ...s.staffList] }));
    get().loadDashboardStats();
  },

  editStaff: async (staffId: string, updates: Partial<Omit<StaffForm, 'mpin'>>) => {
    await updateStaff(staffId, updates);
    set((s) => ({
      staffList: s.staffList.map((st) =>
        st.id === staffId ? { ...st, ...updates, updated_at: new Date().toISOString() } : st
      ),
    }));
  },

  changeMpin: async (staffId: string, newMpin: string) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    await resetStaffMpin(user.id, staffId, newMpin);
  },

  changeStatus: async (staffId: string, status: 'active' | 'inactive') => {
    await toggleStaffStatus(staffId, status);
    set((s) => ({
      staffList: s.staffList.map((st) =>
        st.id === staffId ? { ...st, status, updated_at: new Date().toISOString() } : st
      ),
    }));
    get().loadDashboardStats();
  },

  removeStaff: async (staffId: string) => {
    await deleteStaffService(staffId);
    set((s) => ({
      staffList: s.staffList.filter((st) => st.id !== staffId),
    }));
    get().loadDashboardStats();
  },

  paySalary: async (staffId: string, staffName: string, amount: number, salaryMonth: string) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const payment = await markSalaryPaid(user.id, staffId, staffName, amount, salaryMonth);
    set((s) => ({ salaryPayments: [payment, ...s.salaryPayments] }));
    // Refresh dashboard and expenses since salary creates an expense
    useDashboardStore.getState().loadStats();
    useExpensesStore.getState().loadExpenses();

    // Sync staff salary to Google Sheets
    const businessDate = useDateStore.getState().businessDate;
    gsLogTransaction({
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      businessDate: businessDate,
      transactionType: 'Staff Salary',
      category: 'salary',
      itemName: `${staffName} (${salaryMonth})`,
      quantity: 1,
      price: amount,
      totalAmount: amount,
      paymentMethod: 'cash',
      profit: -amount,
      userName: useAuthStore.getState().activeStaff?.full_name || user.email,
      userRole: useAuthStore.getState().activeStaff?.role || 'owner'
    }).catch(console.error);
  },

  loadSalaryPayments: async (staffId?: string) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    try {
      const payments = await fetchSalaryPayments(user.id, staffId);
      set({ salaryPayments: payments });
    } catch {
      // Silent fail
    }
  },

  getSalarySummary: async (staffId: string) => {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('No user');
    return getStaffSalarySummary(user.id, staffId);
  },

  loadLoginHistory: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    try {
      const history = await fetchLoginHistory(user.id);
      set({ loginHistory: history });
    } catch {
      // Silent fail
    }
  },

  loadPermissions: async (staffId: string) => {
    try {
      const perms = await fetchPermissions(staffId);
      set({ currentPermissions: perms });
    } catch {
      set({ currentPermissions: null });
    }
  },

  setPermissions: async (staffId: string, perms) => {
    await updatePermissions(staffId, perms);
    // Reload permissions
    get().loadPermissions(staffId);
  },

  loadAttendance: async (date: string) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    set({ attendanceLoading: true });
    try {
      const records = await fetchAttendance(user.id, date);
      const attendanceMap: Record<string, 'present' | 'absent' | 'half_day' | 'leave'> = {};
      records.forEach((r) => {
        attendanceMap[r.staff_id] = r.status;
      });
      set({ attendance: attendanceMap });
    } catch {
      // Silent fail
    } finally {
      set({ attendanceLoading: false });
    }
  },

  saveAttendance: async (staffId: string, date: string, status: 'present' | 'absent' | 'half_day' | 'leave') => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    await markAttendance(user.id, staffId, date, status);
    set((s) => ({
      attendance: {
        ...s.attendance,
        [staffId]: status,
      },
    }));
  },
}));
