import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label'; // Keep if needed elsewhere, or remove
import { Input } from '@/components/ui/input'; // Keep if needed elsewhere, or remove
import AuthMessages from '@/app/(auth)/AuthMessages';
import { Database } from '@/lib/database.types';
import { FoodLogForm } from './FoodLogForm'; // Import the client component
import { logFoodItem } from '@/app/client/actions'; // Import the action (will be created next)

type ClientProfile = Database['public']['Tables']['profiles']['Row'];
type FoodItem = Database['public']['Tables']['foods']['Row'];

export default async function LogFoodPage() {
  const supabase = createClient();

  // Verify user and client role
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: clientProfile, error: profileError } = await supabase
    .from('profiles')
    .select('role, coach_id')
    .eq('id', user.id)
    .single();

  if (profileError || !clientProfile || clientProfile.role !== 'client') {
    console.error('Error fetching client profile or invalid role:', profileError);
    redirect('/dashboard?error=Unauthorized access.');
  }
  if (!clientProfile.coach_id) {
     redirect('/dashboard?error=You are not currently assigned to a coach.');
  }

  // TODO: Fetch coach's food library (foods where coach_id = clientProfile.coach_id)
  // const { data: foodLibrary, error: foodError } = await supabase
  //   .from('foods')
  //   .select('*')
  //   .eq('coach_id', clientProfile.coach_id)
  //   .order('name', { ascending: true });

  // Placeholder data for now
  const foodLibrary: FoodItem[] = [];
  const foodError = null;


  if (foodError) {
    console.error('Error fetching food library:', foodError);
    // Handle error display
  }

  return (
    <div className="container mx-auto max-w-2xl p-8">
      <Link href="/dashboard" className="text-sm text-primary hover:underline mb-4 inline-block">
        &larr; Back to Dashboard
      </Link>
      <h1 className="text-3xl font-bold mb-6">Log Food Intake</h1>

      <AuthMessages />

      {foodError && (
        <p className="text-destructive mb-4">Error loading food library. Please try again later.</p>
      )}

      {/* Render the Food Logging Form */}
      <FoodLogForm
        coachId={clientProfile.coach_id}
        logFoodAction={logFoodItem}
      />
    </div>
  );
}
