import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import AuthMessages from '@/app/(auth)/AuthMessages';
import { addWorkoutTemplate } from '@/app/coach/actions'; // Import the action

export default async function AddWorkoutTemplatePage({
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
      <h1 className="mb-6 text-3xl font-bold">Create New Workout Template</h1>

      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-8 shadow-lg">
        <AuthMessages />

        <form className="space-y-6" action={addWorkoutTemplate} >
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-muted-foreground">
              Template Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
              placeholder="e.g., Full Body Strength - Phase 1"
            />
          </div>

           <div>
            <label htmlFor="description" className="block text-sm font-medium text-muted-foreground">
              Description (Optional)
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
              placeholder="Overall goal or focus of this template"
            />
          </div>

          <div className="flex justify-end space-x-4 pt-4">
             <Link
               href="/coach/workouts"
               className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground shadow-sm hover:bg-muted/50"
             >
               Cancel
             </Link>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
            >
              Create Template & Add Exercises
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
