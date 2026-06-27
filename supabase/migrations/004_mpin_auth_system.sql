-- ============================================================
-- SABARISH FOODS — MPIN Authentication System Schema Migration
-- ============================================================

-- Enable pgcrypto for hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 1. UPDATE USERS TABLE SCHEMA ─────────────────────────────────────
-- Drop NOT NULL from email
ALTER TABLE public.users ALTER COLUMN email DROP NOT NULL;

-- Add new columns to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS mpin_hash TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active','inactive'));
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS first_login_completed BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS joining_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS staff_role TEXT CHECK (staff_role IN ('cook','cashier','server','delivery','cleaner','manager','other'));

-- ── 2. COPY DATA FROM STAFF TABLE TO USERS TABLE ──────────────────────
-- Perform copy mapping role and staff_role correctly so we do not violate constraints
INSERT INTO public.users (
  id, owner_id, full_name, phone_number, role, staff_role, mpin_hash, monthly_salary, joining_date, status, created_at, updated_at
)
SELECT
  id, owner_id, full_name, phone_number, 
  CASE WHEN role = 'owner' THEN 'owner' ELSE 'staff' END, 
  CASE WHEN role = 'owner' THEN null ELSE role END, 
  mpin_hash, monthly_salary, joining_date, status, created_at, updated_at
FROM public.staff
ON CONFLICT (id) DO NOTHING;

-- ── 3. UPDATE PERMISSIONS & LOGIN_HISTORY TABLES ──────────────────────
-- Add user_id to permissions
ALTER TABLE public.permissions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE CASCADE;
UPDATE public.permissions SET user_id = staff_id WHERE user_id IS NULL;
ALTER TABLE public.permissions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.permissions DROP CONSTRAINT IF EXISTS permissions_user_id_key;
ALTER TABLE public.permissions ADD CONSTRAINT permissions_user_id_key UNIQUE (user_id);

-- Add user_id to login_history
ALTER TABLE public.login_history ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE CASCADE;
UPDATE public.login_history SET user_id = COALESCE(staff_id, owner_id) WHERE user_id IS NULL;

-- ── 4. RE-POINT FOREIGN KEYS FOR ATTENDANCE AND SALARY ───────────────
-- Points foreign keys to public.users table instead of public.staff
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_staff_id_fkey;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.salary_payments DROP CONSTRAINT IF EXISTS salary_payments_staff_id_fkey;
ALTER TABLE public.salary_payments ADD CONSTRAINT salary_payments_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ── 5. ROW LEVEL SECURITY & POLICIES ──────────────────────────────────
-- Allow all authenticated users (background session) to read/write these tables
DROP POLICY IF EXISTS "users_own" ON public.users;
DROP POLICY IF EXISTS "users_all_auth" ON public.users;
CREATE POLICY "users_all_auth" ON public.users FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "permissions_owner" ON public.permissions;
DROP POLICY IF EXISTS "permissions_all_auth" ON public.permissions;
CREATE POLICY "permissions_all_auth" ON public.permissions FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "login_owner" ON public.login_history;
DROP POLICY IF EXISTS "login_history_all_auth" ON public.login_history;
CREATE POLICY "login_history_all_auth" ON public.login_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sales_own" ON public.sales;
DROP POLICY IF EXISTS "sales_all_auth" ON public.sales;
CREATE POLICY "sales_all_auth" ON public.sales FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "expenses_own" ON public.expenses;
DROP POLICY IF EXISTS "expenses_all_auth" ON public.expenses;
CREATE POLICY "expenses_all_auth" ON public.expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "inventory_own" ON public.inventory;
DROP POLICY IF EXISTS "inventory_all_auth" ON public.inventory;
CREATE POLICY "inventory_all_auth" ON public.inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "cash_own" ON public.cash_balance;
DROP POLICY IF EXISTS "cash_all_auth" ON public.cash_balance;
CREATE POLICY "cash_all_auth" ON public.cash_balance FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "kadan_own" ON public.kadan;
DROP POLICY IF EXISTS "kadan_all_auth" ON public.kadan;
CREATE POLICY "kadan_all_auth" ON public.kadan FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "attendance_owner" ON public.attendance;
DROP POLICY IF EXISTS "attendance_all_auth" ON public.attendance;
CREATE POLICY "attendance_all_auth" ON public.attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "salary_owner" ON public.salary_payments;
DROP POLICY IF EXISTS "salary_payments_all_auth" ON public.salary_payments;
CREATE POLICY "salary_payments_all_auth" ON public.salary_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
