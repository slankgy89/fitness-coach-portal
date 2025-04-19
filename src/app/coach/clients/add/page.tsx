import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { addClient } from '@/app/coach/actions'; // Use alias path
import AuthMessages from '@/app/(auth)/AuthMessages'; // Re-use for displaying messages

export default async function AddClientPage({
  searchParams,
}: {
  searchParams: { message?: string; error?: string };
}) {
  const supabase = createClient();

  // Verify user is logged in and is a coach
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: coachProfile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !coachProfile || coachProfile.role !== 'coach') {
    redirect('/dashboard'); // Redirect non-coaches
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="mb-6 text-3xl font-bold">Add New Client</h1>

      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-8 shadow-lg">
        {/* Render the AuthMessages component */}
        <AuthMessages />

        {/* Add the server action to the form */}
        <form className="space-y-6" action={addClient} >
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-muted-foreground">
              Client's Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
              placeholder="client@example.com"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              The user must already have an account.
            </p>
          </div>

          <div className="flex justify-end space-x-4">
             <Link
               href="/coach/clients"
               className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground shadow-sm hover:bg-muted/50"
             >
               Cancel
             </Link>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
            >
              Add Client
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
