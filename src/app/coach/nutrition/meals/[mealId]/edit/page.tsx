import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import AuthMessages from '@/app/(auth)/AuthMessages';
import { Database } from '@/lib/database.types';
import { Button } from '@/components/ui/button';
// Import the created components
import { MealItemList } from './MealItemList';
import { AddMealItemForm } from './AddMealItemForm';

type Meal = Database['public']['Tables']['meals']['Row'];
type MealItem = Database['public']['Tables']['meal_items']['Row'];
type Food = Database['public']['Tables']['foods']['Row'];

// Define the structure for meal items with nested food data
type MealItemWithFood = MealItem & {
  foods: Food | null; // Food might be null if deleted, handle appropriately
};

// Define the structure for the meal with its items
type MealWithItems = Meal & {
  meal_items: MealItemWithFood[];
};


export default async function EditMealPage({ params }: { params: { mealId: string } }) {
  const supabase = createClient();
  const mealId = params.mealId;

  // Verify user and coach role
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: coachProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!coachProfile || coachProfile.role !== 'coach') redirect('/dashboard');

  // Fetch the meal template and its items with food details
  const { data: mealData, error: mealError } = await supabase
    .from('meals')
    .select(`
      *,
      meal_items (
        *,
        foods (*)
      )
    `)
    .eq('id', mealId)
    .eq('coach_id', user.id)
    .order('sort_order', { referencedTable: 'meal_items', ascending: true }) // Order items
    .single<MealWithItems>(); // Use the combined type

  if (mealError || !mealData) {
    console.error('Error fetching meal template:', mealError);
    notFound(); // Show 404 if meal not found or error occurs
  }

  // Fetch the coach's full food library for the add form selector
  const { data: foodLibrary, error: foodLibraryError } = await supabase
    .from('foods')
    .select('*')
    .eq('coach_id', user.id)
    .order('name', { ascending: true });

  if (foodLibraryError) {
    console.error('Error fetching food library for meal editor:', foodLibraryError);
    // Decide how to handle this - maybe show an error but still render the page?
    // For now, we'll proceed but the add form might not work correctly.
  }

  return (
    <div className="container mx-auto p-8">
      <Link href="/coach/nutrition/meals" className="text-sm text-primary hover:underline mb-4 inline-block">
        &larr; Back to Meal Templates
      </Link>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">{mealData.name}</h1>
        {mealData.description && (
          <p className="mt-1 text-muted-foreground">{mealData.description}</p>
        )}
        {/* TODO: Add click-to-edit for name/description later */}
      </div>

      <AuthMessages />

      {foodLibraryError && (
         <p className="mb-4 text-destructive bg-destructive/10 p-3 rounded-md">
            Warning: Could not load your food library. Adding new items might not work correctly.
         </p>
      )}

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {/* Column 1: Meal Items List */}
        <div className="md:col-span-2">
          <h2 className="text-xl font-semibold mb-4">Meal Items</h2>
          {mealData.meal_items.length === 0 ? (
            <p className="text-muted-foreground">This meal template is empty. Add foods using the form.</p>
          ) : (
            <div className="space-y-4">
              <MealItemList
                mealId={mealId}
                items={mealData.meal_items}
                // Delete action is handled within MealItemList using imported server action
              />
            </div>
          )}
        </div>

        {/* Column 2: Add Item Form */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Add Food to Meal</h2>
          <AddMealItemForm
            mealId={mealId}
            foodLibrary={foodLibrary || []}
            // Add action is handled within AddMealItemForm using imported server action
          />
        </div>
      </div>

       <div className="mt-8 flex justify-end">
         <Button variant="secondary" asChild>
            <Link href="/coach/nutrition/meals">Done Editing</Link>
         </Button>
       </div>
    </div>
  );
}
