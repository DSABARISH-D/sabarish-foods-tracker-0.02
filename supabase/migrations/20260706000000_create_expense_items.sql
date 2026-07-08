-- Create expense_items table
CREATE TABLE IF NOT EXISTS public.expense_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_name TEXT NOT NULL,
    category TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    -- Prevent exact duplicate item names for the same user and category
    CONSTRAINT expense_items_created_by_item_name_category_key UNIQUE (created_by, item_name, category)
);

-- RLS Policies
ALTER TABLE public.expense_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own expense items"
    ON public.expense_items FOR INSERT
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can view their own expense items"
    ON public.expense_items FOR SELECT
    USING (auth.uid() = created_by);

CREATE POLICY "Users can update their own expense items"
    ON public.expense_items FOR UPDATE
    USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own expense items"
    ON public.expense_items FOR DELETE
    USING (auth.uid() = created_by);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_expense_items_created_by_category ON public.expense_items(created_by, category);
