-- Drop the old constraint
ALTER TABLE public.coach_plans
DROP CONSTRAINT coach_plans_interval_check;

-- Add the new constraint allowing day, week, month, year
ALTER TABLE public.coach_plans
ADD CONSTRAINT coach_plans_interval_check 
CHECK ("interval" IN ('day', 'week', 'month', 'year'));
