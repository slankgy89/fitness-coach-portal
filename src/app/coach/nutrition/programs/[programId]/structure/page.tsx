import Link from 'next/link'; // Import Link
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button'; // Import Button
import NutritionProgramStructureEditor from './NutritionProgramStructureEditor';
import { Database } from '@/lib/database.types';
import {
  addNutritionProgramMeal,
  updateNutritionProgramMeal,
  deleteNutritionProgramMeal,
  addNutritionProgramMealItem,
  updateNutritionProgramMealItem,
  deleteNutritionProgramMealItem,
  importUsdaFood,
  addMealTemplateItemsToProgram // Import the new action
} from '@/app/coach/actions';

type ProgramTemplate = Database['public']['Tables']['nutrition_program_templates']['Row'];
type MealTemplate = Database['public']['Tables']['meals']['Row']; // Add type for meal templates

// Define the structure for meals and items fetched from the DB
export interface MealWithItems {
  id: string;
  program_template_id: string;
  day_number: number;
  meal_name: string;
  meal_order: number;
  created_at: string;
  updated_at: string; // Added from previous schema inspection
  nutrition_program_meal_items: MealItemWithFood[];
}

export interface MealItemWithFood {
  id: string;
  meal_id: string;
  food_id: string;
  quantity: number;
  unit: string;
  item_order: number;
  created_at: string;
  updated_at: string; // Added from previous schema inspection
  foods: { // Assuming a join to get food details
    id: string;
    name: string;
    brand_owner: string | null;
    serving_size_qty: number;
    serving_size_unit: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    // Add other food fields if needed
  } | null;
}


async function getProgramDetails(programId: string, supabase: ReturnType<typeof createClient>) {
  // Select duration fields as well
  const { data: program, error } = await supabase
    .from('nutrition_program_templates')
    .select('*, duration_value, duration_unit') // Ensure duration fields are selected
    .eq('id', programId)
    .single();

  if (error) {
    console.error('Error fetching program details:', error);
    return null;
  }
  return program;
}

async function getProgramMealsAndItems(programId: string, supabase: ReturnType<typeof createClient>): Promise<MealWithItems[]> {
    const { data: meals, error } = await supabase
        .from('nutrition_program_meals')
        .select(`
            *,
            nutrition_program_meal_items (
                *,
                foods ( id, name, brand_owner, serving_size_qty, serving_size_unit, calories, protein_g, carbs_g, fat_g )
            )
        `)
        .eq('program_template_id', programId)
        .order('day_number', { ascending: true })
        .order('meal_order', { ascending: true })
        .order('item_order', { referencedTable: 'nutrition_program_meal_items', ascending: true });

    if (error) {
        console.error('Error fetching meals and items:', error);
        return [];
    }

    // Ensure the nested items are sorted correctly if the DB order isn't sufficient
    meals.forEach(meal => {
        meal.nutrition_program_meal_items?.sort((a: MealItemWithFood, b: MealItemWithFood) => a.item_order - b.item_order);
    });


  return meals as MealWithItems[];
}

// Function to fetch meal templates
async function getMealTemplates(coachId: string, supabase: ReturnType<typeof createClient>): Promise<MealTemplate[]> {
    const { data: templates, error } = await supabase
        .from('meals')
        .select('*')
        .eq('coach_id', coachId)
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching meal templates:', error);
        return []; // Return empty array on error
    }
    return templates || [];
}


export default async function NutritionProgramStructurePage({ params }: { params: { programId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/login');
  }

  const program = await getProgramDetails(params.programId, supabase);

  if (!program || program.coach_id !== user.id) {
    // Redirect or show an error if the program doesn't exist or doesn't belong to the coach
    return redirect('/coach/nutrition/programs?error=Program not found or access denied.');
  }

  const mealsWithItems = await getProgramMealsAndItems(params.programId, supabase);
  const mealTemplates = await getMealTemplates(user.id, supabase); // Fetch meal templates

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6"> {/* Added spacing */}
       {/* Add Done button */}
       <div className="flex justify-start mb-4">
         <Link href={`/coach/nutrition/programs/${program.id}/edit`}> {/* Link back to the main edit page */}
           <Button variant="outline">Done</Button>
         </Link>
       </div>
      <h1 className="text-2xl font-bold mb-4">Edit Program Structure: {program.name}</h1>
       {/* Pass fetched data and actions to the client component */}
      <NutritionProgramStructureEditor
        program={program}
        initialMeals={mealsWithItems}
        addMealAction={addNutritionProgramMeal}
        // updateMealAction={updateNutritionProgramMeal} // Removed as it's not used in editor props
        deleteMealAction={deleteNutritionProgramMeal}
        addMealItemAction={addNutritionProgramMealItem}
        updateMealItemAction={updateNutritionProgramMealItem}
        deleteMealItemAction={deleteNutritionProgramMealItem}
        importFoodAction={importUsdaFood}
        mealTemplates={mealTemplates}
        addMealTemplateItemsAction={addMealTemplateItemsToProgram} // Pass the new action
        // Pass duration props
        duration_value={program.duration_value}
        duration_unit={program.duration_unit}
      />
    </div>
  );
}
