import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import AuthMessages from '@/app/(auth)/AuthMessages';
import { assignWorkout } from '@/app/coach/actions'; // Use alias path

// Define types
type ClientProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};
type WorkoutTemplate = {
  id: string;
  name: string;
};

export default async function AssignWorkoutPage({
  searchParams,
}: {
  searchParams: { message?: string; error?: string };
}) {
  const supabase = createClient();

  // 1. Verify user is logged in and is a coach
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: coachProfile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !coachProfile || coachProfile.role !== 'coach') {
    redirect('/dashboard');
  }

  // 2. Fetch coach's clients
  const { data: clients, error: clientsError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('coach_id', user.id)
    .order('last_name');

  // 3. Fetch coach's workout templates
  const { data: templates, error: templatesError } = await supabase
    .from('workout_templates')
    .select('id, name')
    .eq('coach_id', user.id)
    .order('name');

  if (clientsError || templatesError) {
    console.error("Error fetching clients or templates:", clientsError || templatesError);
    // Handle error - maybe show a message
  }

  const defaultDate = new Date().toISOString().split('T')[0]; // Today's date

  return (
    <div className="container mx-auto p-8">
      <h1 className="mb-6 text-3xl font-bold">Assign Workout</h1>

      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-8 shadow-lg">
        <AuthMessages />

        {(!clients || clients.length === 0) && (
             <p className="text-muted-foreground mb-4">
                You need to <Link href="/coach/clients/add" className="text-primary underline">add clients</Link> first.
            </p>
        )}
         {(!templates || templates.length === 0) && (
             <p className="text-muted-foreground mb-4">
                You need to <Link href="/coach/workouts/add" className="text-primary underline">create workout templates</Link> first.
            </p>
        )}

        {(clients && clients.length > 0 && templates && templates.length > 0) && (
            <form className="space-y-6" action={assignWorkout} >
            <div>
                <label htmlFor="clientId" className="block text-sm font-medium text-muted-foreground">Client</label>
                <select name="clientId" id="clientId" required className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm">
                    {clients.map(c => (
                        <option key={c.id} value={c.id}>{`${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Unnamed Client'}</option>
                    ))}
                </select>
            </div>

             <div>
                <label htmlFor="templateId" className="block text-sm font-medium text-muted-foreground">Workout Template</label>
                <select name="templateId" id="templateId" required className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm">
                    {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>
            </div>

             <div>
              <label htmlFor="assignDate" className="block text-sm font-medium text-muted-foreground">
                Assign For Date
              </label>
              <input
                id="assignDate"
                name="assignDate"
                type="date"
                required
                defaultValue={defaultDate}
                className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
              />
            </div>

             <div>
                <label htmlFor="notes" className="block text-sm font-medium text-muted-foreground">
                Notes for Client (Optional)
                </label>
                <textarea
                id="notes"
                name="notes"
                rows={3}
                className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                placeholder="Any specific instructions or encouragement for this day?"
                />
            </div>


            <div className="flex justify-end space-x-4 pt-4">
                <Link
                href="/dashboard" // Or maybe back to client detail page if coming from there?
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground shadow-sm hover:bg-muted/50"
                >
                Cancel
                </Link>
                <button
                type="submit"
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
                >
                Assign Workout
                </button>
            </div>
            </form>
        )}
      </div>
    </div>
  );
}
