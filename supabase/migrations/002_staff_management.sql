-- ============================================================
-- SABARISH FOODS — Staff Management Migration v2
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable pgcrypto for MPIN hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 1. STAFF ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.staff (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL,
  phone_number    TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'other' CHECK (role IN (
                    'cook','cashier','server','delivery','cleaner','manager','owner','other'
                  )),
  mpin_hash       TEXT NOT NULL,
  monthly_salary  NUMERIC(12,2) NOT NULL DEFAULT 0,
  joining_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. SALARY PAYMENTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.salary_payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id        UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  owner_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  salary_month    TEXT NOT NULL,  -- e.g. '2026-06'
  paid_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  expense_id      UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. LOGIN HISTORY ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.login_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id        UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  owner_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_name       TEXT NOT NULL,
  user_type       TEXT NOT NULL CHECK (user_type IN ('owner','staff')),
  login_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  login_time      TIME NOT NULL DEFAULT LOCALTIME,
  logout_time     TIME,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. PERMISSIONS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.permissions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id        UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  owner_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  dashboard       BOOLEAN NOT NULL DEFAULT TRUE,
  expenses        BOOLEAN NOT NULL DEFAULT FALSE,
  inventory       BOOLEAN NOT NULL DEFAULT FALSE,
  credit          BOOLEAN NOT NULL DEFAULT FALSE,
  reports         BOOLEAN NOT NULL DEFAULT FALSE,
  settings        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(staff_id)
);

-- ── Update expenses category constraint to include 'staff' ───────────
-- First drop the existing check constraint
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_category_check;

-- Add updated constraint with 'staff' category
ALTER TABLE public.expenses ADD CONSTRAINT expenses_category_check
  CHECK (category IN (
    'chicken_cost','store_purchases','market_purchases',
    'indian_market','electricity','gas_cylinder',
    'staff','transport','other'
  ));

-- Update any existing 'staff_salary' records to 'staff'
UPDATE public.expenses SET category = 'staff' WHERE category = 'staff_salary';

-- ── INDEXES ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_staff_owner        ON public.staff(owner_id);
CREATE INDEX IF NOT EXISTS idx_staff_status       ON public.staff(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_salary_staff       ON public.salary_payments(staff_id);
CREATE INDEX IF NOT EXISTS idx_salary_owner       ON public.salary_payments(owner_id);
CREATE INDEX IF NOT EXISTS idx_salary_month       ON public.salary_payments(staff_id, salary_month);
CREATE INDEX IF NOT EXISTS idx_login_owner        ON public.login_history(owner_id);
CREATE INDEX IF NOT EXISTS idx_login_date         ON public.login_history(owner_id, login_date);
CREATE INDEX IF NOT EXISTS idx_permissions_staff  ON public.permissions(staff_id);

-- ── ROW LEVEL SECURITY ──────────────────────────────────────────────
ALTER TABLE public.staff           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_history   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions     ENABLE ROW LEVEL SECURITY;

-- Staff: owner can manage their staff
CREATE POLICY "staff_owner" ON public.staff
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Salary Payments: owner can manage
CREATE POLICY "salary_owner" ON public.salary_payments
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Login History: owner can view
CREATE POLICY "login_owner" ON public.login_history
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Permissions: owner can manage
CREATE POLICY "permissions_owner" ON public.permissions
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- ── Helper function: Hash MPIN ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.hash_mpin(raw_mpin TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  RETURN crypt(raw_mpin, gen_salt('bf'));
END;
$$;

-- ── Helper function: Verify MPIN ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.verify_mpin(raw_mpin TEXT, hashed TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
BEGIN
  RETURN hashed = crypt(raw_mpin, hashed);
END;
$$;
