import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import AuthMessages from '@/app/(auth)/AuthMessages';
import { PlusCircle, Edit, Trash2, ArrowLeft } from 'lucide-react'; // Import icons
import { DeleteProgramButton } from './DeleteProgramButton'; // Import the new component

// Define type for Nutrition Program Template
type NutritionProgramTemplate = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  // Add summary fields
  day_count: number;
  avg_meals_per_day: number;
  total_items: number;
};

// Helper type for fetching counts
type ProgramSummaryData = {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    meals: {
        day_number: number;
        items_count: { count: number }[]; // Array because Supabase returns count in an array
    }[];
};


export default async function NutritionProgramsPage() {
  const supabase = createClient();

  // Verify user and coach role
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: coachProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!coachProfile || coachProfile.role !== 'coach') redirect('/dashboard');

  // Fetch nutrition program templates with meal and item counts
  const { data: programsData, error: programsError } = await supabase
    .from('nutrition_program_templates')
    .select(`
      id,
      name,
      description,
      category,
      meals:nutrition_program_meals (
        day_number,
        items_count:nutrition_program_meal_items (count)
      )
    `)
    .eq('coach_id', user.id)
    .order('name', { ascending: true });

  // Calculate summaries after fetching
  const programs: NutritionProgramTemplate[] = (programsData || []).map((p: ProgramSummaryData) => {
      const meals = p.meals || [];
      const days = new Set(meals.map(m => m.day_number));
      const dayCount = days.size;
      const totalMeals = meals.length;
      const totalItems = meals.reduce((sum, meal) => sum + (meal.items_count[0]?.count ?? 0), 0);
      const avgMealsPerDay = dayCount > 0 ? parseFloat((totalMeals / dayCount).toFixed(1)) : 0;

      return {
          id: p.id,
          name: p.name,
          description: p.description,
          category: p.category,
          day_count: dayCount,
          avg_meals_per_day: avgMealsPerDay,
          total_items: totalItems,
      };
  });

  if (programsError) {
    console.error('Error fetching nutrition programs:', programsError);
    // Handle error display appropriately
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        {/* Moved Back Button Here */}
        <Link href="/dashboard">
           <Button variant="outline">
             <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
           </Button>
        </Link>
        {/* Title and Add Button Container */}
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">Nutrition Programs</h1>
          <Link href="/coach/nutrition/programs/add">
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Program
            </Button>
          </Link>
        </div>
      </div>

      <AuthMessages />

      {programsError && (
        <p className="text-destructive">Error loading nutrition programs. Please try again.</p>
      )}

      {!programsError && programs && programs.length === 0 && (
        <div className="text-center py-10 border border-dashed rounded-lg">
            <h3 className="text-lg font-medium text-muted-foreground">No Nutrition Programs Yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Create your first nutrition program template.</p>
            <Link href="/coach/nutrition/programs/add">
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Program
              </Button>
            </Link>
        </div>
      )}

      {!programsError && programs && programs.length > 0 && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {programs.map((program: NutritionProgramTemplate) => (
            <div key={program.id} className="rounded-lg border bg-card p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col"> {/* Added flex flex-col */}
              <div className="flex justify-between items-start mb-3">
                 {/* Program Name Link */}
                 <Link href={`/coach/nutrition/programs/${program.id}/edit`} className="hover:underline flex-grow mr-2">
                    <h3 className="text-xl font-semibold truncate" title={program.name}>{program.name}</h3>
                 </Link>
                 {/* Action Buttons Container */}
                 <div className="flex items-center space-x-1 flex-shrink-0">
                    {/* Edit Button */}
                    <Link href={`/coach/nutrition/programs/${program.id}/edit`} title="Edit Program">
                       <Button variant="ghost" size="icon">
                           <Edit className="h-4 w-4" />
                           <span className="sr-only">Edit</span>
                       </Button>
                    </Link>
                    {/* Delete Button */}
                    <DeleteProgramButton programId={program.id} programName={program.name} />
                 </div>
              </div>
              {program.category && (
                 <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">{program.category}</p>
              )}
              {/* Added flex-grow to allow description to take up space */}
              <p className="text-sm text-muted-foreground mb-4 flex-grow">
                {program.description || 'No description provided.'}
              </p>
              {/* Removed fixed height */}
              <div className="border-t pt-4 mt-auto"> {/* Added mt-auto to push summary to bottom */}
                 <p className="text-xs text-muted-foreground">Summary:</p>
                 <ul className="text-sm mt-1 space-y-1">
                    <li>Days: <span className="font-medium">{program.day_count}</span></li>
                    <li>Avg Meals/Day: <span className="font-medium">{program.avg_meals_per_day}</span></li>
                    <li>Total Items: <span className="font-medium">{program.total_items}</span></li>
                 </ul>
              </div>
            </div>
          ))}
        </div>
      )}

       {/* Removed Back link from here, it's now in the header */}
    </div>
  );
}
