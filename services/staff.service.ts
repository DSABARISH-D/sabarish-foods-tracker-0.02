import { supabase } from '@/lib/supabase';
import {
  Staff,
  StaffForm,
  SalaryPayment,
  LoginHistoryEntry,
  StaffPermissions,
  AttendanceRecord,
} from '@/types';
import { getTodayDate } from '@/lib/utils';

// ── MPIN Hashing (client-side SHA-256) ────────────────────────────────
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

async function verifyMpin(mpin: string, hash: string): Promise<boolean> {
  const computed = await hashMpin(mpin);
  return computed === hash;
}

// ── Staff CRUD ────────────────────────────────────────────────────────
export async function fetchStaff(ownerId: string): Promise<Staff[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  
  return (data ?? []).map(u => ({
    ...u,
    role: u.role === 'staff' ? u.staff_role : u.role,
  })) as Staff[];
}

export async function fetchStaffById(staffId: string): Promise<Staff | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', staffId)
    .single();
  if (error) return null;
  
  return {
    ...data,
    role: data.role === 'staff' ? data.staff_role : data.role,
  } as Staff;
}

export async function insertStaff(ownerId: string, form: StaffForm): Promise<Staff> {
  // Check MPIN uniqueness
  const { data: existing } = await supabase
    .from('users')
    .select('id, mpin_hash')
    .or(`owner_id.eq.${ownerId},id.eq.${ownerId}`);

  if (existing) {
    for (const u of existing) {
      if (await verifyMpin(form.mpin, u.mpin_hash)) {
        throw new Error('MPIN already in use by another user');
      }
    }
  }

  const mpinHash = await hashMpin(form.mpin);
  const dbRole = form.role === 'owner' ? 'owner' : 'staff';
  const dbStaffRole = form.role === 'owner' ? null : form.role;

  const { data, error } = await supabase
    .from('users')
    .insert({
      owner_id: ownerId,
      full_name: form.full_name,
      phone_number: form.phone_number,
      role: dbRole,
      staff_role: dbStaffRole,
      mpin_hash: mpinHash,
      monthly_salary: form.monthly_salary,
      joining_date: form.joining_date,
      status: form.status,
    })
    .select()
    .single();
  if (error) throw error;

  // Create default permissions
  await supabase.from('permissions').insert({
    user_id: data.id,
    dashboard: true,
    expenses: form.role === 'owner',
    inventory: form.role === 'owner',
    credit: form.role === 'owner',
    reports: form.role === 'owner',
    settings: form.role === 'owner',
  });

  return {
    ...data,
    role: data.role === 'staff' ? data.staff_role : data.role,
  } as Staff;
}

export async function updateStaff(
  staffId: string,
  updates: Partial<Omit<StaffForm, 'mpin'>>
): Promise<void> {
  const updateData: Record<string, any> = { ...updates, updated_at: new Date().toISOString() };
  delete updateData.mpin;

  if (updates.role !== undefined) {
    updateData.role = updates.role === 'owner' ? 'owner' : 'staff';
    updateData.staff_role = updates.role === 'owner' ? null : updates.role;
  }

  const { error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', staffId);
  if (error) throw error;
}

export async function resetStaffMpin(
  ownerId: string,
  staffId: string,
  newMpin: string
): Promise<void> {
  // Check uniqueness
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, mpin_hash')
    .or(`owner_id.eq.${ownerId},id.eq.${ownerId}`)
    .neq('id', staffId);

  if (allUsers) {
    for (const u of allUsers) {
      if (await verifyMpin(newMpin, u.mpin_hash)) {
        throw new Error('MPIN already in use by another user');
      }
    }
  }

  const mpinHash = await hashMpin(newMpin);
  const { error } = await supabase
    .from('users')
    .update({ mpin_hash: mpinHash, updated_at: new Date().toISOString() })
    .eq('id', staffId);
  if (error) throw error;
}

export async function toggleStaffStatus(staffId: string, status: 'active' | 'inactive'): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', staffId);
  if (error) throw error;
}

export async function deleteStaff(staffId: string): Promise<void> {
  // Delete permissions first
  await supabase.from('permissions').delete().eq('user_id', staffId);
  // Delete salary payments
  await supabase.from('salary_payments').delete().eq('staff_id', staffId);
  // Delete attendance
  await supabase.from('attendance').delete().eq('staff_id', staffId);
  // Delete user from users table
  const { error } = await supabase.from('users').delete().eq('id', staffId);
  if (error) throw error;
}

// ── Salary Payments ──────────────────────────────────────────────────
export async function fetchSalaryPayments(
  ownerId: string,
  staffId?: string
): Promise<SalaryPayment[]> {
  let query = supabase
    .from('salary_payments')
    .select('*')
    .eq('owner_id', ownerId)
    .order('paid_date', { ascending: false });

  if (staffId) {
    query = query.eq('staff_id', staffId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as SalaryPayment[];
}

export async function markSalaryPaid(
  ownerId: string,
  staffId: string,
  staffName: string,
  amount: number,
  salaryMonth: string
): Promise<SalaryPayment> {
  const today = getTodayDate();

  // 1. Create expense record for salary
  const { data: expense, error: expError } = await supabase
    .from('expenses')
    .insert({
      user_id: ownerId,
      category: 'staff',
      amount,
      description: `${staffName} - Salary ${salaryMonth}`,
      date: today,
    })
    .select()
    .single();
  if (expError) throw expError;

  // 2. Create salary payment record
  const { data, error } = await supabase
    .from('salary_payments')
    .insert({
      staff_id: staffId,
      owner_id: ownerId,
      amount,
      salary_month: salaryMonth,
      paid_date: today,
      expense_id: expense.id,
      notes: `${staffName} - Salary ${salaryMonth}`,
    })
    .select()
    .single();
  if (error) throw error;

  return data as SalaryPayment;
}

export async function getStaffSalarySummary(
  ownerId: string,
  staffId: string
): Promise<{
  monthly_salary: number;
  total_paid: number;
  pending: number;
  payments: SalaryPayment[];
}> {
  const [staff, payments] = await Promise.all([
    fetchStaffById(staffId),
    fetchSalaryPayments(ownerId, staffId),
  ]);

  if (!staff) throw new Error('Staff not found');

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  // Calculate months since joining
  const joiningDate = new Date(staff.joining_date);
  const now = new Date();
  const monthsSinceJoining = (now.getFullYear() - joiningDate.getFullYear()) * 12
    + (now.getMonth() - joiningDate.getMonth()) + 1;
  const totalOwed = staff.monthly_salary * Math.max(0, monthsSinceJoining);
  const pending = Math.max(0, totalOwed - totalPaid);

  return {
    monthly_salary: staff.monthly_salary,
    total_paid: totalPaid,
    pending,
    payments,
  };
}

// ── Login History ────────────────────────────────────────────────────
export async function fetchLoginHistory(ownerId: string): Promise<LoginHistoryEntry[]> {
  const { data, error } = await supabase
    .from('login_history')
    .select('*')
    .order('login_date', { ascending: false })
    .order('login_time', { ascending: false })
    .limit(50);
  if (error) throw error;
  
  return (data ?? []).map(d => ({
    id: d.id,
    owner_id: ownerId,
    staff_id: d.user_id,
    user_name: d.user_name,
    user_type: d.user_type,
    login_date: d.login_date,
    login_time: d.login_time,
    logout_time: d.logout_time,
  })) as LoginHistoryEntry[];
}

export async function recordLogin(
  ownerId: string,
  userName: string,
  userType: 'owner' | 'staff',
  staffId?: string
): Promise<void> {
  const { error } = await supabase
    .from('login_history')
    .insert({
      user_id: staffId || ownerId,
      user_name: userName,
      user_type: userType,
    });
  if (error) throw error;
}

// ── Permissions ──────────────────────────────────────────────────────
export async function fetchPermissions(staffId: string): Promise<StaffPermissions | null> {
  const { data, error } = await supabase
    .from('permissions')
    .select('*')
    .eq('staff_id', staffId)
    .single();
  if (error) return null;
  
  return {
    id: data.id,
    staff_id: data.staff_id,
    owner_id: data.owner_id,
    dashboard: data.dashboard,
    expenses: data.expenses,
    inventory: data.inventory,
    credit: data.credit,
    reports: data.reports,
    settings: data.settings,
    notes: data.notes || false,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function updatePermissions(
  staffId: string,
  permissions: Partial<Pick<StaffPermissions, 'dashboard' | 'expenses' | 'inventory' | 'credit' | 'reports' | 'settings' | 'notes'>>
): Promise<void> {
  const updateData: Record<string, any> = {};
  if (permissions.dashboard !== undefined) updateData.dashboard = permissions.dashboard;
  if (permissions.expenses !== undefined) updateData.expenses = permissions.expenses;
  if (permissions.inventory !== undefined) updateData.inventory = permissions.inventory;
  if (permissions.credit !== undefined) updateData.credit = permissions.credit;
  if (permissions.reports !== undefined) updateData.reports = permissions.reports;
  if (permissions.settings !== undefined) updateData.settings = permissions.settings;

  const { error } = await supabase
    .from('permissions')
    .update(updateData)
    .eq('staff_id', staffId);
  if (error) throw error;
}

// ── Dashboard Stats ──────────────────────────────────────────────────
export async function getStaffDashboardStats(ownerId: string): Promise<{
  total: number;
  active: number;
  inactive: number;
}> {
  const { data, error } = await supabase
    .from('users')
    .select('status')
    .eq('owner_id', ownerId);

  if (error) throw error;

  const staff = data ?? [];
  return {
    total: staff.length,
    active: staff.filter(s => s.status === 'active').length,
    inactive: staff.filter(s => s.status === 'inactive').length,
  };
}

// ── Attendance ────────────────────────────────────────────────────────
export async function fetchAttendance(ownerId: string, date: string): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('date', date);
  if (error) throw error;
  return (data ?? []) as AttendanceRecord[];
}

export async function markAttendance(
  ownerId: string,
  staffId: string,
  date: string,
  status: 'present' | 'absent' | 'half_day' | 'leave'
): Promise<void> {
  const { error } = await supabase
    .from('attendance')
    .upsert(
      {
        owner_id: ownerId,
        staff_id: staffId,
        date,
        status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'staff_id,date' }
    );
  if (error) throw error;
}

export async function changeUserMpin(userId: string, currentMpin: string, newMpin: string): Promise<void> {
  const { data, error: fetchErr } = await supabase
    .from('users')
    .select('mpin_hash')
    .eq('id', userId)
    .single();
  if (fetchErr) throw fetchErr;

  const matches = await verifyMpin(currentMpin, data.mpin_hash);
  if (!matches) {
    throw new Error('Current MPIN is incorrect');
  }

  const newHash = await hashMpin(newMpin);
  const { error: updateErr } = await supabase
    .from('users')
    .update({ mpin_hash: newHash, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (updateErr) throw updateErr;
}
