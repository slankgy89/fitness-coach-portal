import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AuthMessages from '@/app/(auth)/AuthMessages';
import { Button } from '@/components/ui/button';
import { FoodListTable } from './FoodListTable';
import { UsdaImportDialog } from './UsdaImportDialog';
import { updateFood, deleteFood, importUsdaFood } from '@/app/coach/actions'; // Import server actions including importUsdaFood

// Define type for food items (ensure it includes all fields needed by FoodListTable)
type FoodItem = {
  id: string;
  name: string;
  brand_owner: string | null;
  serving_size_qty: number;
  serving_size_unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  source: string;
};

export default async function NutritionLibraryPage() {
  const supabase = createClient();

  // Verify user and coach role
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: coachProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!coachProfile || coachProfile.role !== 'coach') redirect('/dashboard');

  // Fetch foods created by this coach (include optional fields and full nutrients)
  const { data: foods, error: foodsError } = await supabase
    .from('foods')
    .select('id, name, brand_owner, serving_size_qty, serving_size_unit, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, source, full_nutrients') // Added full_nutrients
    .eq('coach_id', user.id)
    .order('name', { ascending: true });

  if (foodsError) {
    console.error('Error fetching food library:', foodsError);
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Food Library (The Secret Sauce)</h1>
        <div className="space-x-2">
            {/* USDA Import Button removed */}
            <Link
              href="/coach/nutrition/foods/add"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              Add Manual Food
            </Link>
        </div>
      </div>

      <AuthMessages />

      {foodsError && (
        <p className="text-destructive">Error loading food library. Please try again.</p>
      )}

      {!foodsError && foods && foods.length === 0 && (
        <p className="text-muted-foreground">Your nutrition library is empty. Add some foods manually or import them.</p>
      )}

      {!foodsError && foods && foods.length > 0 && (
         <FoodListTable
           foods={foods}
           updateFoodAction={updateFood}
           deleteFoodAction={deleteFood}
         />
      )}
       <div className="mt-8"> {/* Increased margin top */}
         <Link href="/dashboard" className="text-sm text-primary hover:underline">
           &larr; Back to Dashboard
         </Link>
       </div>
    </div>
  );
}
