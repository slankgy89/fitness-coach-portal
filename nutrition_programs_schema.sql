-- SQL Script for Nutrition Programs Feature

-- 1. Create nutrition_program_templates table
CREATE TABLE public.nutrition_program_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    category text, -- Consider making this an enum later if needed
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.nutrition_program_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for nutrition_program_templates
CREATE POLICY "Allow coaches to view their own templates"
ON public.nutrition_program_templates
FOR SELECT USING (auth.uid() = coach_id);

CREATE POLICY "Allow coaches to insert their own templates"
ON public.nutrition_program_templates
FOR INSERT WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Allow coaches to update their own templates"
ON public.nutrition_program_templates
FOR UPDATE USING (auth.uid() = coach_id)
WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Allow coaches to delete their own templates"
ON public.nutrition_program_templates
FOR DELETE USING (auth.uid() = coach_id);

-- Optional: Index on coach_id for faster lookups
CREATE INDEX idx_nutrition_program_templates_coach_id ON public.nutrition_program_templates(coach_id);


-- 2. Create nutrition_program_meals table
CREATE TABLE public.nutrition_program_meals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    program_template_id uuid NOT NULL REFERENCES public.nutrition_program_templates(id) ON DELETE CASCADE,
    day_number integer NOT NULL DEFAULT 1 CHECK (day_number > 0),
    meal_name text NOT NULL,
    meal_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add unique constraint for meal order within a day/template
ALTER TABLE public.nutrition_program_meals
ADD CONSTRAINT unique_meal_order_per_day UNIQUE (program_template_id, day_number, meal_order);

-- Enable RLS
ALTER TABLE public.nutrition_program_meals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for nutrition_program_meals
-- We need to join to templates to check coach_id for SELECT/INSERT/UPDATE/DELETE
CREATE POLICY "Allow coaches to view meals of their own templates"
ON public.nutrition_program_meals
FOR SELECT USING (
    EXISTS (
        SELECT 1
        FROM public.nutrition_program_templates t
        WHERE t.id = program_template_id AND t.coach_id = auth.uid()
    )
);

CREATE POLICY "Allow coaches to insert meals for their own templates"
ON public.nutrition_program_meals
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.nutrition_program_templates t
        WHERE t.id = program_template_id AND t.coach_id = auth.uid()
    )
);

CREATE POLICY "Allow coaches to update meals of their own templates"
ON public.nutrition_program_meals
FOR UPDATE USING (
    EXISTS (
        SELECT 1
        FROM public.nutrition_program_templates t
        WHERE t.id = program_template_id AND t.coach_id = auth.uid()
    )
) WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.nutrition_program_templates t
        WHERE t.id = program_template_id AND t.coach_id = auth.uid()
    )
);

CREATE POLICY "Allow coaches to delete meals from their own templates"
ON public.nutrition_program_meals
FOR DELETE USING (
    EXISTS (
        SELECT 1
        FROM public.nutrition_program_templates t
        WHERE t.id = program_template_id AND t.coach_id = auth.uid()
    )
);

-- Optional: Indexes
CREATE INDEX idx_nutrition_program_meals_template_id ON public.nutrition_program_meals(program_template_id);


-- 3. Create nutrition_program_meal_items table
CREATE TABLE public.nutrition_program_meal_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_id uuid NOT NULL REFERENCES public.nutrition_program_meals(id) ON DELETE CASCADE,
    food_id uuid NOT NULL REFERENCES public.foods(id) ON DELETE RESTRICT, -- Prevent deleting food if used here? Or CASCADE? RESTRICT is safer.
    quantity numeric NOT NULL CHECK (quantity > 0),
    unit text NOT NULL,
    item_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.nutrition_program_meal_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for nutrition_program_meal_items
-- Need to join through meals to templates to check coach_id
CREATE POLICY "Allow coaches to view items of their own templates"
ON public.nutrition_program_meal_items
FOR SELECT USING (
    EXISTS (
        SELECT 1
        FROM public.nutrition_program_meals m
        JOIN public.nutrition_program_templates t ON m.program_template_id = t.id
        WHERE m.id = meal_id AND t.coach_id = auth.uid()
    )
);

CREATE POLICY "Allow coaches to insert items for their own templates"
ON public.nutrition_program_meal_items
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.nutrition_program_meals m
        JOIN public.nutrition_program_templates t ON m.program_template_id = t.id
        WHERE m.id = meal_id AND t.coach_id = auth.uid()
    )
);

CREATE POLICY "Allow coaches to update items of their own templates"
ON public.nutrition_program_meal_items
FOR UPDATE USING (
    EXISTS (
        SELECT 1
        FROM public.nutrition_program_meals m
        JOIN public.nutrition_program_templates t ON m.program_template_id = t.id
        WHERE m.id = meal_id AND t.coach_id = auth.uid()
    )
) WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.nutrition_program_meals m
        JOIN public.nutrition_program_templates t ON m.program_template_id = t.id
        WHERE m.id = meal_id AND t.coach_id = auth.uid()
    )
);

CREATE POLICY "Allow coaches to delete items from their own templates"
ON public.nutrition_program_meal_items
FOR DELETE USING (
    EXISTS (
        SELECT 1
        FROM public.nutrition_program_meals m
        JOIN public.nutrition_program_templates t ON m.program_template_id = t.id
        WHERE m.id = meal_id AND t.coach_id = auth.uid()
    )
);

-- Optional: Indexes
CREATE INDEX idx_nutrition_program_meal_items_meal_id ON public.nutrition_program_meal_items(meal_id);
CREATE INDEX idx_nutrition_program_meal_items_food_id ON public.nutrition_program_meal_items(food_id);

-- Function to update updated_at column automatically (if not already existing)
-- Ensure this function exists or create it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_updated_at') THEN
    CREATE FUNCTION public.handle_updated_at()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END $$;

-- Triggers to update updated_at on templates, meals, and items
-- Drop trigger first if it exists, then create
DROP TRIGGER IF EXISTS on_template_update ON public.nutrition_program_templates;
CREATE TRIGGER on_template_update
BEFORE UPDATE ON public.nutrition_program_templates
FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

DROP TRIGGER IF EXISTS on_meal_update ON public.nutrition_program_meals;
CREATE TRIGGER on_meal_update
BEFORE UPDATE ON public.nutrition_program_meals
FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

DROP TRIGGER IF EXISTS on_meal_item_update ON public.nutrition_program_meal_items;
CREATE TRIGGER on_meal_item_update
BEFORE UPDATE ON public.nutrition_program_meal_items
FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
