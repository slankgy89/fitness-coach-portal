import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { logout } from '@/app/(auth)/actions';
import Link from 'next/link';
import { checkSubscriptionStatus } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button'; // Import Button for prompt
import { revalidatePath } from 'next/cache';

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.log("[Dashboard] No user found, redirecting to login.");
    redirect('/login');
  }

  // Fetch user profile to determine role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, first_name, last_name') // Fetch role and name
    .eq('id', user.id)
    .single();

  // Handle potential error fetching profile (e.g., if trigger failed silently)
  if (profileError && profileError.code !== 'PGRST116') {
    console.error("[Dashboard] Error fetching profile:", profileError);
    // Optionally redirect or show an error message - consider a user-friendly error page
  } 

  const userRole = profile?.role ?? 'client';
  const userName = profile?.first_name ? `${profile.first_name} ${profile.last_name ?? ''}`.trim() : user.email;

  // Check subscription status for the logged-in user
  // Note: This assumes checkSubscriptionStatus correctly handles different roles/client types
  // or we might need to pass the role/coach_id if logic differs.
  // For now, assume it checks the user's own subscription if they are a client.
  const hasActiveSubscription = await checkSubscriptionStatus(user.id);
  console.log(`[Dashboard] User ${user.id} has active subscription: ${hasActiveSubscription}`);

    // For clients without a subscription, display message and redirect
    if (userRole === 'client' && !hasActiveSubscription) {
        console.log(`[Dashboard] Client ${user.id} does not have an active subscription. Redirecting...`);
        redirect('/our-plans'); // Redirect immediately
    }

    // Revalidate the path to ensure fresh data on subsequent visits
    revalidatePath('/dashboard');

    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-8">
        <h1 className="text-3xl font-bold">Welcome, {userName}!</h1>
        <p className="mt-4 text-muted-foreground">Your Role: {userRole}</p>
      <p className="mt-6">This is your dashboard.</p>

      {/* Role-specific content placeholder */}
      {userRole === 'coach' && (
        <div className="mt-8 space-y-4">
          <h2 className="text-xl font-semibold">Coach Actions</h2>
          {/* Link to Client Management */}
          <Link
            href="/coach/clients"
            className="inline-block rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground shadow-sm hover:bg-secondary/80"
          >
            Manage Clients
          </Link>
          {/* Link to Schedule Management */}
          <Link
            href="/coach/schedule"
            className="inline-block rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground shadow-sm hover:bg-secondary/80"
          >
            Manage Schedule
          </Link>
           {/* Link to Document Management */}
          <Link
            href="/coach/documents"
            className="inline-block rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground shadow-sm hover:bg-secondary/80"
          >
            Manage Documents
          </Link>
          {/* Link to Exercise Library */}
          <Link
            href="/coach/exercises"
            className="inline-block rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground shadow-sm hover:bg-secondary/80"
          >
            Manage Exercises
          </Link>
          {/* Link to Workout Templates */}
          <Link
            href="/coach/workouts"
            className="inline-block rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground shadow-sm hover:bg-secondary/80"
          >
            Manage Workouts
          </Link>
          {/* Link to Nutrition Programs */}
          <Link
            href="/coach/nutrition/programs"
            className="inline-block rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground shadow-sm hover:bg-secondary/80"
          >
            Nutrition Programs
          </Link>
           {/* Link to Assign Workout */}
          <Link
            href="/coach/assign-workout"
            className="inline-block rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700"
          >
            Assign Workout to Client
          </Link>
           {/* Link to Settings */}
          <Link
            href="/coach/settings"
            className="inline-block rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground shadow-sm hover:bg-secondary/80"
          >
            Account Settings
          </Link>
           {/* Link to Manage Plans */}
          <Link
            href="/coach/plans"
            className="inline-block rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground shadow-sm hover:bg-secondary/80"
          >
            Manage Plans
          </Link>
          {/* Add more links later */}
        </div>
      )}
      {userRole === 'client' && (
         <div className="mt-8 space-y-4">
          <h2 className="text-xl font-semibold">Client Actions</h2>
          {/* Link to Booking Page */}
           <Link
            href="/client/booking"
            className="inline-block rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground shadow-sm hover:bg-secondary/80"
          >
            Book Session / Class
          </Link>
          {/* Link to Documents Page */}
           <Link
            href="/client/documents"
            className="inline-block rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground shadow-sm hover:bg-secondary/80"
          >
            My Documents
          </Link>
          {/* Link to Today's Workout */}
           <Link
            href="/client/my-workout"
            className="inline-block rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground shadow-sm hover:bg-secondary/80"
          >
            Today's Workout
          </Link>
          {/* Link to Manage Subscription */}
           <Link
            href="/client/subscription"
            className="inline-block rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground shadow-sm hover:bg-secondary/80"
          >
            Manage Subscription
          </Link>
          {/* Add more links later */}
        </div>
      )}
      <form action={logout} className="mt-6">
        <button
          type="submit"
          className="rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground shadow-sm hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2 focus:ring-offset-background"
        >
          Log Out
        </button>
      </form>
      {/* Add role-specific content later */}
    </div>
    );
}
