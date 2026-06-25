-- ============================================================
-- SABARISH FOODS — Supabase Schema Migration v1
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. USERS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       TEXT UNIQUE NOT NULL,
  full_name   TEXT NOT NULL DEFAULT 'Owner',
  role        TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','staff')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. SALES ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sales (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  category        TEXT CHECK (category IN ('rice_meals','noodles','tiffin','beverages','other')),
  description     TEXT,
  payment_method  TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash','upi','card','credit')),
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  synced_to_sheets BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. EXPENSES ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.expenses (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category             TEXT NOT NULL CHECK (category IN (
                         'chicken_cost','store_purchases','market_purchases',
                         'indian_market','electricity','gas_cylinder',
                         'staff_salary','transport','other'
                       )),
  amount               NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  description          TEXT,
  date                 DATE NOT NULL DEFAULT CURRENT_DATE,
  chicken_kg           NUMERIC(8,3),
  chicken_price_per_kg NUMERIC(8,2),
  locked               BOOLEAN NOT NULL DEFAULT FALSE,
  synced_to_sheets     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. INVENTORY ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_name           TEXT NOT NULL CHECK (item_name IN ('chicken','oil','masala','rice','gas','other')),
  quantity            NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit                TEXT NOT NULL DEFAULT 'kg',
  low_stock_threshold NUMERIC(12,3) NOT NULL DEFAULT 5,
  last_updated        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, item_name)
);

-- ── 5. CASH BALANCE ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cash_balance (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  petty_cash   NUMERIC(12,2) NOT NULL DEFAULT 0,
  cash_in_hand NUMERIC(12,2) NOT NULL DEFAULT 0,
  cash_in_bank NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ── 6. KADAN (CREDIT) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kadan (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  customer_name   TEXT NOT NULL,
  mobile_number   TEXT NOT NULL,
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  due_date        DATE NOT NULL,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue')),
  paid_date       DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── INDEXES ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sales_user_date      ON public.sales(user_id, date);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date   ON public.expenses(user_id, date);
CREATE INDEX IF NOT EXISTS idx_kadan_user_status    ON public.kadan(user_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_user       ON public.inventory(user_id);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────
ALTER TABLE public.users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kadan        ENABLE ROW LEVEL SECURITY;

-- Users: can only see/edit own profile
CREATE POLICY "users_own" ON public.users
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Sales: own rows only
CREATE POLICY "sales_own" ON public.sales
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Expenses: own rows only
CREATE POLICY "expenses_own" ON public.expenses
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Inventory: own rows only
CREATE POLICY "inventory_own" ON public.inventory
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Cash Balance: own rows only
CREATE POLICY "cash_own" ON public.cash_balance
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Kadan: own rows only
CREATE POLICY "kadan_own" ON public.kadan
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── TRIGGER: Auto-create profile + defaults on signup ─────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Create user profile
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Owner')
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create cash balance
  INSERT INTO public.cash_balance (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Create default inventory items
  INSERT INTO public.inventory (user_id, item_name, quantity, unit, low_stock_threshold) VALUES
    (NEW.id, 'chicken', 0, 'kg',        10),
    (NEW.id, 'oil',     0, 'litres',     5),
    (NEW.id, 'masala',  0, 'kg',         2),
    (NEW.id, 'rice',    0, 'kg',        20),
    (NEW.id, 'gas',     0, 'cylinders',  1)
  ON CONFLICT (user_id, item_name) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Drop and recreate trigger to avoid duplicates
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
