import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AuthMessages from '@/app/(auth)/AuthMessages';
import { Button } from '@/components/ui/button';
import { Database } from '@/lib/database.types'; // Import generated types
import { MealListTable } from './MealListTable'; // Import the table component
import { deleteMealTemplate } from '@/app/coach/actions'; // Import the delete action

// Define type alias for Meal
type Meal = Database['public']['Tables']['meals']['Row'];

export default async function CoachMealsPage() {
  const supabase = createClient();

  // Verify user and coach role
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: coachProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!coachProfile || coachProfile.role !== 'coach') redirect('/dashboard');

  // Fetch meals created by this coach (select all columns to match the Meal type)
  const { data: meals, error: mealsError } = await supabase
    .from('meals')
    .select('*') // Select all fields defined in the Meal type
    .eq('coach_id', user.id)
    .order('name', { ascending: true });

  if (mealsError) {
    console.error('Error fetching meals:', mealsError);
    // Handle error display appropriately
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Meal Templates (The Secret Sauce)</h1>
        <Link
          href="/coach/nutrition/meals/add"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          Add New Meal Template
        </Link>
      </div>

      <AuthMessages />

      {mealsError && (
        <p className="text-destructive">Error loading meal templates. Please try again.</p>
      )}

      {!mealsError && meals && meals.length === 0 && (
        <div className="mt-6 rounded-lg border border-border bg-card p-6 text-center shadow-sm">
            <h3 className="text-lg font-semibold text-foreground">No Meal Templates Yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
                Create reusable meal templates to quickly add them to nutrition programs.
            </p>
            <Button asChild className="mt-4">
                <Link href="/coach/nutrition/meals/add">Create Your First Meal Template</Link>
            </Button>
        </div>
      )}

      {!mealsError && meals && meals.length > 0 && (
        <div className="mt-6">
          <MealListTable meals={meals} deleteAction={deleteMealTemplate} />
        </div>
      )}

       <div className="mt-8">
         <Link href="/dashboard" className="text-sm text-primary hover:underline">
           &larr; Back to Dashboard
         </Link>
       </div>
    </div>
  );
}
