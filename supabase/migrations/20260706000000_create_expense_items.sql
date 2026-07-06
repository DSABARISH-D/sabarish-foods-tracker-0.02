-- Create expense_items table
CREATE TABLE IF NOT EXISTS public.expense_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'store_purchases' or 'market_purchases'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Prevent exact duplicate item names for the same user and category
    CONSTRAINT expense_items_user_name_category_key UNIQUE (user_id, item_name, category)
);

-- RLS Policies
ALTER TABLE public.expense_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own expense items"
    ON public.expense_items FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own expense items"
    ON public.expense_items FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own expense items"
    ON public.expense_items FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own expense items"
    ON public.expense_items FOR DELETE
    USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_expense_items_user_category ON public.expense_items(user_id, category);
