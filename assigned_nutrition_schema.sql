-- assigned_nutrition_programs table: Tracks which nutrition programs are assigned to which clients by coaches
CREATE TABLE public.assigned_nutrition_programs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    program_template_id uuid NOT NULL REFERENCES public.nutrition_program_templates(id) ON DELETE RESTRICT, -- Prevent deleting template if assigned
    start_date date NOT NULL,
    end_date date, -- Optional: Calculated based on template duration or set manually
    status text DEFAULT 'active'::text CHECK (status IN ('active', 'completed', 'cancelled')), -- Track assignment status
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    -- Removed inline partial unique constraint here
    CONSTRAINT assigned_nutrition_programs_dates_check CHECK (end_date IS NULL OR end_date >= start_date) -- Ensure end_date is after start_date if set
);

-- Indexes for performance
CREATE INDEX idx_assigned_nutrition_coach_id ON public.assigned_nutrition_programs(coach_id);
CREATE INDEX idx_assigned_nutrition_client_id ON public.assigned_nutrition_programs(client_id);
CREATE INDEX idx_assigned_nutrition_template_id ON public.assigned_nutrition_programs(program_template_id);

-- Create the partial unique index separately
CREATE UNIQUE INDEX assigned_nutrition_programs_client_active_unique_idx
ON public.assigned_nutrition_programs (client_id, status)
WHERE (status = 'active');

-- Enable RLS
ALTER TABLE public.assigned_nutrition_programs ENABLE ROW LEVEL SECURITY;

-- Coaches can manage assignments for their own clients
CREATE POLICY "Allow coaches full access to assignments for own clients"
ON public.assigned_nutrition_programs
FOR ALL
USING (auth.uid() = coach_id AND client_id IN (SELECT id FROM public.profiles WHERE coach_id = auth.uid()))
WITH CHECK (auth.uid() = coach_id AND client_id IN (SELECT id FROM public.profiles WHERE coach_id = auth.uid()));

-- Clients can read their own assignments
CREATE POLICY "Allow clients read access to own assignments"
ON public.assigned_nutrition_programs
FOR SELECT
USING (auth.uid() = client_id);

-- Trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_assigned_nutrition_program_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on modification
CREATE TRIGGER on_assigned_nutrition_program_update
BEFORE UPDATE ON public.assigned_nutrition_programs
FOR EACH ROW
EXECUTE FUNCTION public.handle_assigned_nutrition_program_update();

-- Add comments for clarity
COMMENT ON TABLE public.assigned_nutrition_programs IS 'Tracks nutrition program assignments from coaches to clients.';
COMMENT ON COLUMN public.assigned_nutrition_programs.status IS 'Status of the assignment (e.g., active, completed, cancelled).';
COMMENT ON INDEX assigned_nutrition_programs_client_active_unique_idx IS 'Ensures a client has only one active nutrition program assignment at a time.';
