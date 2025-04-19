import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns'; // For formatting dates/times

// Define type for schedule slots
type ScheduleSlot = {
  id: string;
  start_time: string;
  end_time: string;
  slot_type: string;
  title: string | null;
  max_attendees: number;
  // We might need booking counts later
};

export default async function CoachSchedulePage() {
  const supabase = createClient();

  // 1. Get current user & verify coach role (similar to clients page)
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

  // 2. Fetch schedule slots for this coach (e.g., future slots)
  const now = new Date().toISOString();
  const { data: slots, error: slotsError } = await supabase
    .from('schedule_slots')
    .select('id, start_time, end_time, slot_type, title, max_attendees')
    .eq('coach_id', user.id)
    .gte('start_time', now) // Fetch only future slots for now
    .order('start_time', { ascending: true });

  if (slotsError) {
    console.error('Error fetching schedule slots:', slotsError);
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">My Schedule</h1>
        {/* Add Slot Button - Link to a future /coach/schedule/add page */}
        <Link
          href="/coach/schedule/add"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          Add Availability / Class
        </Link>
      </div>

      {slotsError && (
        <p className="text-destructive">Error loading schedule. Please try again.</p>
      )}

      {!slotsError && slots && slots.length === 0 && (
        <p className="text-muted-foreground">You haven't added any upcoming availability or classes yet.</p>
      )}

      {!slotsError && slots && slots.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Date</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Time</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Type / Title</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Capacity</th>
                 {/* Add Bookings column later */}
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {slots.map((slot: ScheduleSlot) => (
                <tr key={slot.id}>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground">
                    {format(new Date(slot.start_time), 'PPP')} {/* e.g., Jun 20, 2024 */}
                  </td>
                   <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground">
                    {format(new Date(slot.start_time), 'p')} - {format(new Date(slot.end_time), 'p')} {/* e.g., 9:00 AM - 10:00 AM */}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-foreground">
                    {slot.title || slot.slot_type}
                  </td>
                   <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                    {/* Display bookings count later */} / {slot.max_attendees}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                    {/* Add Edit/Delete actions later */}
                    <button disabled className="text-muted-foreground/50">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
       <div className="mt-6">
         <Link href="/dashboard" className="text-sm text-primary hover:underline">
           &larr; Back to Dashboard
         </Link>
       </div>
    </div>
  );
}
