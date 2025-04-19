-- meals table: Stores reusable meal templates created by coaches
CREATE TABLE public.meals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (char_length(name) > 0),
    description text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT meals_coach_id_name_key UNIQUE (coach_id, name) -- Ensure unique meal names per coach
);

-- Enable RLS
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;

-- Allow coaches full access to their own meals
CREATE POLICY "Allow coaches full access to own meals"
ON public.meals
FOR ALL
USING (auth.uid() = coach_id)
WITH CHECK (auth.uid() = coach_id);

-- Add comment for clarity
COMMENT ON TABLE public.meals IS 'Stores reusable meal templates created by coaches.';


-- meal_items table: Links foods to meals, defining the composition of a meal template
CREATE TABLE public.meal_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_id uuid NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
    food_id uuid NOT NULL REFERENCES public.foods(id) ON DELETE RESTRICT, -- Prevent deleting food if used in a meal? Or CASCADE? Let's start with RESTRICT.
    quantity numeric NOT NULL CHECK (quantity > 0), -- Multiplier for the food's standard serving size
    sort_order integer DEFAULT 0, -- For ordering items within the meal
    created_at timestamp with time zone NOT NULL DEFAULT now()
    -- No updated_at needed here, treat items as immutable within the meal; edits involve delete/re-add or changing quantity.
);

-- Indexes for performance
CREATE INDEX idx_meal_items_meal_id ON public.meal_items(meal_id);
CREATE INDEX idx_meal_items_food_id ON public.meal_items(food_id);

-- Enable RLS
ALTER TABLE public.meal_items ENABLE ROW LEVEL SECURITY;

-- Allow coaches full access to items in their own meals
CREATE POLICY "Allow coaches full access to items in own meals"
ON public.meal_items
FOR ALL
USING (
    EXISTS (
        SELECT 1
        FROM public.meals m
        WHERE m.id = meal_items.meal_id AND m.coach_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.meals m
        WHERE m.id = meal_items.meal_id AND m.coach_id = auth.uid()
    )
);

-- Add comment for clarity
COMMENT ON TABLE public.meal_items IS 'Links foods to specific meals, defining quantity and order.';
COMMENT ON COLUMN public.meal_items.quantity IS 'Multiplier for the associated food''s standard serving size.';

-- Trigger function to update meals.updated_at when meal_items change
CREATE OR REPLACE FUNCTION public.update_meal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.meals
    SET updated_at = now()
    WHERE id = COALESCE(OLD.meal_id, NEW.meal_id); -- Handle INSERT, UPDATE, DELETE
    RETURN COALESCE(NEW, OLD); -- Return appropriate record
END;
$$ LANGUAGE plpgsql;

-- Trigger to update meal timestamp when items are added/modified/deleted
CREATE TRIGGER handle_meal_item_change
AFTER INSERT OR UPDATE OR DELETE ON public.meal_items
FOR EACH ROW
EXECUTE FUNCTION public.update_meal_updated_at();
