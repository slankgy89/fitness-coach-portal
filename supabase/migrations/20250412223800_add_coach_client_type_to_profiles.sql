-- Add coach_id (nullable foreign key to profiles)
ALTER TABLE public.profiles
ADD COLUMN coach_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL; -- Or ON DELETE CASCADE? Decide based on desired behavior

-- Add client_type ('direct' or 'managed')
ALTER TABLE public.profiles
ADD COLUMN client_type TEXT DEFAULT 'direct'; -- Default new signups to 'direct'

-- Add index for coach_id lookup
CREATE INDEX idx_profiles_coach_id ON public.profiles(coach_id);

-- Note: Need to manually update existing client profiles to set coach_id 
-- and potentially client_type='managed' if applicable.
-- Also need coach functionality to add clients and set these fields.
