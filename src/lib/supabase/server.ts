// Import the specific type for createClient
import { createClient as createServerSupabaseClient } from '@supabase/supabase-js'; 
import { createServerClient as createSsrClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Regular client for component/middleware use WITH user context
export function createClient() {
  const cookieStore = cookies();

  // Create a server-side Supabase client object using the SSR helper
  return createSsrClient( // Use the aliased import name here
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Make functions async and await cookieStore methods
        async get(name: string) {
          return (await cookieStore).get(name)?.value;
        },
        async set(name: string, value: string, options: CookieOptions) {
          try {
            (await cookieStore).set({ name, value, ...options });
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        async remove(name: string, options: CookieOptions) {
          try {
            (await cookieStore).set({ name, value: '', ...options });
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

// Admin client using SERVICE_ROLE for bypassing RLS (e.g., in middleware checks for other users)
const supabaseAdmin = createServerSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } } 
);


// Function to check if a user has an active subscription
export async function checkSubscriptionStatus(userId: string): Promise<boolean> {
  console.log(`[checkSubscriptionStatus] Checking for userId: ${userId}`); // Log input userId
  // Use the ADMIN client to bypass RLS when checking potentially other users' status
  const { data: subscription, error } = await supabaseAdmin 
    .from('subscriptions')
    .select('status') // Restore selecting only status
    .eq('user_id', userId)
    .in('status', ['active', 'trialing']) // Restore status filter
    .maybeSingle(); 

  if (error) {
    console.error(`[checkSubscriptionStatus] Error fetching subscription for ${userId}:`, error);
    return false; // Assume no subscription on error
  }

  if (error) {
    console.error(`[checkSubscriptionStatus] Error fetching subscription for ${userId}:`, error);
    return false; // Assume no subscription on error
  }

  // Restore logging and original return logic
  console.log(`[checkSubscriptionStatus] Found subscription for ${userId}:`, subscription); 
  const isActive = !!subscription;
  console.log(`[checkSubscriptionStatus] Returning ${isActive} for ${userId}`);
  return isActive; 
}
