-- Update nutrition_program_templates table for detailed nutritional targets

-- Drop old single target columns if they exist (idempotent)
ALTER TABLE public.nutrition_program_templates
DROP COLUMN IF EXISTS target_calories,
DROP COLUMN IF EXISTS target_protein_g,
DROP COLUMN IF EXISTS target_carbs_g,
DROP COLUMN IF EXISTS target_fat_g;

-- Add new columns for min/max targets and calorie type
ALTER TABLE public.nutrition_program_templates
ADD COLUMN IF NOT EXISTS calorie_target_type TEXT CHECK (calorie_target_type IN ('deficit', 'absolute')),
ADD COLUMN IF NOT EXISTS min_calories NUMERIC CHECK (min_calories >= 0),
ADD COLUMN IF NOT EXISTS max_calories NUMERIC CHECK (max_calories >= 0),
ADD COLUMN IF NOT EXISTS min_protein_grams NUMERIC CHECK (min_protein_grams >= 0),
ADD COLUMN IF NOT EXISTS max_protein_grams NUMERIC CHECK (max_protein_grams >= 0),
ADD COLUMN IF NOT EXISTS min_carb_grams NUMERIC CHECK (min_carb_grams >= 0),
ADD COLUMN IF NOT EXISTS max_carb_grams NUMERIC CHECK (max_carb_grams >= 0),
ADD COLUMN IF NOT EXISTS min_fat_grams NUMERIC CHECK (min_fat_grams >= 0),
ADD COLUMN IF NOT EXISTS max_fat_grams NUMERIC CHECK (max_fat_grams >= 0),
ADD COLUMN IF NOT EXISTS min_sugar_grams NUMERIC CHECK (min_sugar_grams >= 0),
ADD COLUMN IF NOT EXISTS max_sugar_grams NUMERIC CHECK (max_sugar_grams >= 0);

-- Add comments for clarity
COMMENT ON COLUMN public.nutrition_program_templates.calorie_target_type IS 'Type of calorie goal: ''deficit'' or ''absolute''.';
COMMENT ON COLUMN public.nutrition_program_templates.min_calories IS 'Minimum daily calories target.';
COMMENT ON COLUMN public.nutrition_program_templates.max_calories IS 'Maximum daily calories target.';
COMMENT ON COLUMN public.nutrition_program_templates.min_protein_grams IS 'Minimum daily protein target in grams.';
COMMENT ON COLUMN public.nutrition_program_templates.max_protein_grams IS 'Maximum daily protein target in grams.';
COMMENT ON COLUMN public.nutrition_program_templates.min_carb_grams IS 'Minimum daily carbohydrate target in grams.';
COMMENT ON COLUMN public.nutrition_program_templates.max_carb_grams IS 'Maximum daily carbohydrate target in grams.';
COMMENT ON COLUMN public.nutrition_program_templates.min_fat_grams IS 'Minimum daily fat target in grams.';
COMMENT ON COLUMN public.nutrition_program_templates.max_fat_grams IS 'Maximum daily fat target in grams.';
COMMENT ON COLUMN public.nutrition_program_templates.min_sugar_grams IS 'Minimum daily sugar target in grams.';
COMMENT ON COLUMN public.nutrition_program_templates.max_sugar_grams IS 'Maximum daily sugar target in grams.';

-- Note: target_meals_per_day column is kept from previous script if it existed.
-- ALTER TABLE public.nutrition_program_templates ADD COLUMN IF NOT EXISTS target_meals_per_day integer;
-- COMMENT ON COLUMN public.nutrition_program_templates.target_meals_per_day IS 'Optional target number of meals per day for the program.';
