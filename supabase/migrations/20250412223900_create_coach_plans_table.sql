-- Create Coach Plans Table
CREATE TABLE public.coach_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_product_id text NOT NULL, -- Stripe Product ID (prod_...)
  stripe_price_id text NOT NULL UNIQUE, -- Stripe Price ID (price_...)
  name text NOT NULL,
  description text,
  price integer NOT NULL, -- Price in smallest currency unit (e.g., cents)
  currency text NOT NULL DEFAULT 'usd',
  "interval" text NOT NULL CHECK ("interval" IN ('month', 'year')), -- Use quoted "interval"
  interval_count integer NOT NULL DEFAULT 1,
  features text[], -- Array of text features
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_coach_plans_coach_id ON public.coach_plans(coach_id);
CREATE INDEX idx_coach_plans_stripe_price_id ON public.coach_plans(stripe_price_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.coach_plans ENABLE ROW LEVEL SECURITY;

-- Policy: Coaches can manage (select, insert, update, delete) their own plans
CREATE POLICY "Coaches can manage their own plans"
ON public.coach_plans
FOR ALL -- Applies to SELECT, INSERT, UPDATE, DELETE
USING (auth.uid() = coach_id)
WITH CHECK (auth.uid() = coach_id);

-- Policy: Allow authenticated users to read active plans (e.g., for profile pages)
-- Note: Adjust this if you only want specific roles (like clients) to see plans
CREATE POLICY "Authenticated users can view active plans"
ON public.coach_plans
FOR SELECT
USING (is_active = true AND auth.role() = 'authenticated'); 
-- Or restrict further: USING (is_active = true AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()));
