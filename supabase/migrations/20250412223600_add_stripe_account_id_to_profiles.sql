-- Add stripe_account_id column to profiles table
ALTER TABLE public.profiles
ADD COLUMN stripe_account_id TEXT UNIQUE; -- Store the 'acct_...' ID, make it unique

-- Optional: Add an index for faster lookups if needed later
-- CREATE INDEX idx_profiles_stripe_account_id ON public.profiles(stripe_account_id);
