-- Add notes permission column to permissions table
ALTER TABLE public.permissions ADD COLUMN IF NOT EXISTS notes BOOLEAN DEFAULT false;

-- Create notes table
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT, -- Business, Supplier, Customer, Staff, Reminder, Other
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Note: In this app, restaurant_id is essentially the owner_id. 
-- Both owner and authorized staff use the same restaurant_id.

-- Owners can do everything
CREATE POLICY "Owners can view their notes"
    ON public.notes FOR SELECT
    USING (auth.uid() = restaurant_id);

CREATE POLICY "Owners can insert notes"
    ON public.notes FOR INSERT
    WITH CHECK (auth.uid() = restaurant_id);

CREATE POLICY "Owners can update their notes"
    ON public.notes FOR UPDATE
    USING (auth.uid() = restaurant_id);

CREATE POLICY "Owners can delete their notes"
    ON public.notes FOR DELETE
    USING (auth.uid() = restaurant_id);

-- Staff can view notes if they have permission
CREATE POLICY "Staff can view notes if permitted"
    ON public.notes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.permissions p
            WHERE p.staff_id = auth.uid() 
            AND p.owner_id = notes.restaurant_id
            AND p.notes = true
        )
    );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_notes_restaurant_id ON public.notes(restaurant_id);
