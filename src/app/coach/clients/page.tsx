import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

// Define the type for a client profile (can be expanded later)
type ClientProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  // Add other relevant client fields like email if needed from profiles or auth.users
};

export default async function CoachClientsPage() {
  const supabase = createClient();

  // 1. Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 2. Get current user's profile and verify role
  const { data: coachProfile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !coachProfile || coachProfile.role !== 'coach') {
    console.error('Access denied or error fetching coach profile:', profileError);
    // Redirect non-coaches or if profile error occurs
    redirect('/dashboard'); // Or show an unauthorized message
  }

  // 3. Fetch clients linked to this coach
  const { data: clients, error: clientsError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name') // Select desired client fields
    .eq('coach_id', user.id) // Filter by the current coach's ID
    .order('last_name', { ascending: true }); // Order clients alphabetically

  if (clientsError) {
    console.error('Error fetching clients:', clientsError);
    // Handle error - maybe show a message on the page
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">My Clients</h1>
        {/* Add Client Button - Link to a future /coach/clients/add page */}
        <Link
          href="/coach/clients/add"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          Add New Client
        </Link>
      </div>

      {clientsError && (
        <p className="text-destructive">Error loading clients. Please try again.</p>
      )}

      {!clientsError && clients && clients.length === 0 && (
        <p className="text-muted-foreground">You haven't added any clients yet.</p>
      )}

      {!clientsError && clients && clients.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Name
                </th>
                {/* Add more columns as needed */}
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {clients.map((client: ClientProfile) => (
                <tr key={client.id}>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-foreground">
                    {`${client.first_name ?? ''} ${client.last_name ?? ''}`.trim() || 'N/A'}
                  </td>
                  {/* Add more client data cells */}
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                    {/* Link to a future client detail page */}
                    <Link href={`/coach/clients/${client.id}`} className="text-primary hover:underline">
                      View Details
                    </Link>
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
