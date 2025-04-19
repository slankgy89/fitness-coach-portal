import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import AuthMessages from '@/app/(auth)/AuthMessages'; // Re-use for displaying messages
import { addScheduleSlot } from '@/app/coach/actions'; // Import the action

export default async function AddScheduleSlotPage({
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

  // Basic date/time handling for defaults - consider a date picker component later
  const now = new Date();
  const defaultDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const defaultStartTime = now.toTimeString().substring(0, 5); // HH:MM

  return (
    <div className="container mx-auto p-8">
      <h1 className="mb-6 text-3xl font-bold">Add Availability / Class</h1>

      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-8 shadow-lg">
        <AuthMessages />

        <form className="space-y-6" action={addScheduleSlot} >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-muted-foreground">
                Date
              </label>
              <input
                id="date"
                name="date"
                type="date"
                required
                defaultValue={defaultDate}
                className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
              />
            </div>
             <div> {/* Placeholder for potential time zone info */} </div>
             <div>
              <label htmlFor="startTime" className="block text-sm font-medium text-muted-foreground">
                Start Time
              </label>
              <input
                id="startTime"
                name="startTime"
                type="time"
                required
                 defaultValue={defaultStartTime}
                className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
              />
            </div>
             <div>
              <label htmlFor="endTime" className="block text-sm font-medium text-muted-foreground">
                End Time
              </label>
              <input
                id="endTime"
                name="endTime"
                type="time"
                required
                className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="slotType" className="block text-sm font-medium text-muted-foreground">
              Type
            </label>
            <select
              id="slotType"
              name="slotType"
              required
              defaultValue="session"
              className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
            >
              <option value="session">1-on-1 Session</option>
              <option value="class">Group Class</option>
            </select>
          </div>

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-muted-foreground">
              Title / Name (Optional, e.g., "Yoga Basics", "PT Slot")
            </label>
            <input
              id="title"
              name="title"
              type="text"
              className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
              placeholder="Optional description"
            />
          </div>

           <div>
            <label htmlFor="maxAttendees" className="block text-sm font-medium text-muted-foreground">
              Max Attendees / Capacity
            </label>
            <input
              id="maxAttendees"
              name="maxAttendees"
              type="number"
              required
              min="1"
              defaultValue="1"
              className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
            />
          </div>


          <div className="flex justify-end space-x-4 pt-4">
             <Link
               href="/coach/schedule"
               className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground shadow-sm hover:bg-muted/50"
             >
               Cancel
             </Link>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
            >
              Add to Schedule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
