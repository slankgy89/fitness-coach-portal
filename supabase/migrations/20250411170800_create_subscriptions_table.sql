-- Create Subscriptions Table
CREATE TABLE IF NOT EXISTS public.subscriptions ( -- Add IF NOT EXISTS
      id text PRIMARY KEY, -- Changed from uuid to text to match Stripe IDs
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      plan_id uuid REFERENCES public.coach_plans(id) ON DELETE SET NULL, -- Added plan_id reference
      status text, -- e.g., 'active', 'trialing', 'past_due', 'canceled', 'incomplete'
  current_period_end timestamptz, -- When the current subscription period ends
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id); -- Add IF NOT EXISTS

-- Add index for faster lookups by stripe_subscription_id (now just id)
-- CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON public.subscriptions(id); -- Primary key index is automatic

-- Enable Row Level Security (RLS)
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own subscription status
DROP POLICY IF EXISTS "Users can view their own subscription" ON public.subscriptions; -- Drop first
CREATE POLICY "Users can view their own subscription" -- Then create
ON public.subscriptions
FOR SELECT
USING (auth.uid() = user_id);

-- Note: Inserting/Updating subscriptions should ideally only happen via webhooks
-- triggered by Stripe events, handled by server-side code using the service_role key
-- or bypassing RLS. Direct client-side modification should not be allowed.
-- Therefore, INSERT/UPDATE/DELETE policies for users are generally not needed.
