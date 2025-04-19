-- Function to create a profile for a new user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, last_name, role, coach_id)
  values (
    new.id, 
    new.email,
    new.raw_user_meta_data->>'first_name', -- Extract from metadata
    new.raw_user_meta_data->>'last_name',  -- Extract from metadata
    COALESCE(new.raw_user_meta_data->>'role', 'client'),      -- Extract from metadata, default to 'client' if null
    -- Assign default coach if role is client and coach_id not provided
    case 
      when COALESCE(new.raw_user_meta_data->>'role', 'client') = 'client' 
        and new.raw_user_meta_data->>'coach_id' is null 
      then 'b6b6003e-decc-45f9-bd01-5d527ef500c9'::uuid
      else (new.raw_user_meta_data->>'coach_id')::uuid
    end
  );
  return new;
end;
$$;

-- Trigger to call the function after a new user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Optional: Add RLS policy for profiles if not already present
-- Make sure users can only select/update their own profile
-- alter table public.profiles enable row level security;

-- create policy "Users can view their own profile."
--   on public.profiles for select
--   using ( auth.uid() = id );

-- create policy "Users can update their own profile."
--   on public.profiles for update
--   using ( auth.uid() = id );
