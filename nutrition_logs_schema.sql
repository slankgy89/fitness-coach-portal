-- nutrition_logs table: Tracks food/meal consumption logged by clients
CREATE TABLE public.nutrition_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    coach_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- Store coach_id for easier RLS/querying
    log_date date NOT NULL DEFAULT CURRENT_DATE,
    meal_name text, -- Optional: e.g., 'Breakfast', 'Lunch', 'Snack'
    food_id uuid NOT NULL REFERENCES public.foods(id) ON DELETE RESTRICT, -- Reference the specific food consumed
    quantity numeric NOT NULL CHECK (quantity > 0),
    unit text NOT NULL,
    calories numeric, -- Store calculated/logged calories for this entry
    protein_g numeric, -- Store calculated/logged protein
    carbs_g numeric, -- Store calculated/logged carbs
    fat_g numeric, -- Store calculated/logged fat
    notes text, -- Optional client notes
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT nutrition_logs_coach_fkey FOREIGN KEY (coach_id) REFERENCES public.profiles(id) ON DELETE CASCADE -- Explicit FK for coach_id
);

-- Indexes
CREATE INDEX idx_nutrition_logs_client_date ON public.nutrition_logs(client_id, log_date);
CREATE INDEX idx_nutrition_logs_coach_client ON public.nutrition_logs(coach_id, client_id);
CREATE INDEX idx_nutrition_logs_food_id ON public.nutrition_logs(food_id);

-- Enable RLS
ALTER TABLE public.nutrition_logs ENABLE ROW LEVEL SECURITY;

-- Clients can manage their own logs
CREATE POLICY "Allow clients full access to own nutrition logs"
ON public.nutrition_logs
FOR ALL
USING (auth.uid() = client_id)
WITH CHECK (auth.uid() = client_id);

-- Coaches can read logs for their own clients
CREATE POLICY "Allow coaches read access to logs for own clients"
ON public.nutrition_logs
FOR SELECT
USING (auth.uid() = coach_id AND client_id IN (SELECT id FROM public.profiles WHERE coach_id = auth.uid()));

-- Trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_nutrition_log_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on modification
CREATE TRIGGER on_nutrition_log_update
BEFORE UPDATE ON public.nutrition_logs
FOR EACH ROW
EXECUTE FUNCTION public.handle_nutrition_log_update();

-- Comments
COMMENT ON TABLE public.nutrition_logs IS 'Stores individual food/meal consumption entries logged by clients.';
COMMENT ON COLUMN public.nutrition_logs.coach_id IS 'Denormalized coach_id for easier RLS and querying by coaches.';
COMMENT ON COLUMN public.nutrition_logs.calories IS 'Calculated or logged calories for this specific log entry.';
COMMENT ON COLUMN public.nutrition_logs.protein_g IS 'Calculated or logged protein (grams) for this specific log entry.';
COMMENT ON COLUMN public.nutrition_logs.carbs_g IS 'Calculated or logged carbohydrates (grams) for this specific log entry.';
COMMENT ON COLUMN public.nutrition_logs.fat_g IS 'Calculated or logged fat (grams) for this specific log entry.';
