import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { bookSlot } from '@/app/coach/actions'; // Ensure import points to coach actions
import AuthMessages from '@/app/(auth)/AuthMessages'; // Import for messages

// Define type for schedule slots (can share with coach page later)
type ScheduleSlot = {
  id: string;
  start_time: string;
  end_time: string;
  slot_type: string;
  title: string | null;
  max_attendees: number;
  // Need booking info
  bookings: { count: number }[]; // Supabase can count related bookings
};

export default async function ClientBookingPage() {
  const supabase = createClient();

  // 1. Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 2. Get client's profile to find their coach_id
  const { data: clientProfile, error: profileError } = await supabase
    .from('profiles')
    .select('role, coach_id')
    .eq('id', user.id)
    .single();

  // Redirect if not a client or error fetching profile
  if (profileError || !clientProfile || clientProfile.role !== 'client') {
    redirect('/dashboard');
  }

  // Redirect if client has no coach assigned yet
  if (!clientProfile.coach_id) {
    return (
       <div className="container mx-auto p-8">
         <h1 className="mb-6 text-3xl font-bold">Book a Session / Class</h1>
         <p className="text-muted-foreground">You are not currently assigned to a coach. Please contact support.</p>
          <div className="mt-6">
            <Link href="/dashboard" className="text-sm text-primary hover:underline">
              &larr; Back to Dashboard
            </Link>
          </div>
       </div>
    );
  }

  // 3. Fetch upcoming, available slots for the client's coach
  const now = new Date().toISOString();
  const { data: slots, error: slotsError } = await supabase
    .from('schedule_slots')
    .select(`
      id, start_time, end_time, slot_type, title, max_attendees,
      bookings ( count )
    `) // Fetch slots and count existing bookings
    .eq('coach_id', clientProfile.coach_id) // Only slots from the client's coach
    .gte('start_time', now) // Only future slots
    .order('start_time', { ascending: true });

  if (slotsError) {
    console.error('Error fetching schedule slots for client:', slotsError);
  }

  // TODO: Filter out slots the client has already booked

  return (
    <div className="container mx-auto p-8">
      <h1 className="mb-6 text-3xl font-bold">Book a Session / Class</h1>

      {/* Display messages */}
      <AuthMessages />

      {slotsError && (
        <p className="text-destructive">Error loading schedule. Please try again.</p>
      )}

      {!slotsError && slots && slots.length === 0 && (
        <p className="text-muted-foreground">Your coach has no upcoming availability.</p>
      )}

      {!slotsError && slots && slots.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {slots.map((slot: ScheduleSlot) => {
            const bookingCount = slot.bookings[0]?.count ?? 0;
            const isFull = bookingCount >= slot.max_attendees;
            // TODO: Check if current user already booked this slot

            return (
              <div key={slot.id} className="rounded-lg border border-border bg-card p-4 shadow">
                <h3 className="font-semibold text-foreground">{slot.title || slot.slot_type}</h3>
                <p className="text-sm text-muted-foreground">{format(new Date(slot.start_time), 'PPP')}</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(slot.start_time), 'p')} - {format(new Date(slot.end_time), 'p')}
                </p>
                <p className="mt-2 text-sm">Spots left: {slot.max_attendees - bookingCount}</p>

                {/* Booking Form/Button */}
                <form className="mt-4" action={bookSlot} >
                  <input type="hidden" name="slotId" value={slot.id} />
                  <button
                    type="submit"
                    disabled={isFull} // Disable if full
                    className={`w-full rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm ${
                      isFull
                        ? 'cursor-not-allowed bg-muted text-muted-foreground'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    }`}
                  >
                    {isFull ? 'Fully Booked' : 'Book Now'}
                  </button>
                </form>
              </div>
            );
          })}
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
