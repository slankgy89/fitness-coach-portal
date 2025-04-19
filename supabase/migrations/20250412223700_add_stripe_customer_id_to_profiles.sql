-- Add stripe_customer_id column to profiles table
ALTER TABLE public.profiles
ADD COLUMN stripe_customer_id TEXT;

-- Optional: Add an index for faster lookups if needed later
-- CREATE INDEX idx_profiles_stripe_customer_id ON public.profiles(stripe_customer_id);
