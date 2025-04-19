import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button'; // Keep Button if needed elsewhere, maybe for a future Save All?
import AuthMessages from '@/app/(auth)/AuthMessages';
import { NutritionProgramEditor } from './NutritionProgramEditor';
import {
  // Removed meal/item actions that are no longer passed
  updateNutritionProgramTemplateDetails // Import the action for details update
} from '@/app/coach/actions';
import { Database } from '@/lib/database.types'; // Import Database type

type NutritionProgramParams = {
  params: {
    programId: string;
  };
};

// Define ProgramTemplate type locally, ensuring specific literal types match component expectations
type ProgramTemplate = Omit<Database['public']['Tables']['nutrition_program_templates']['Row'], 'calorie_target_type' | 'duration_unit'> & {
  calorie_target_type: 'fixed' | 'deficit' | null;
  duration_unit: 'days' | 'weeks' | 'months' | null; // Add specific type for duration_unit
};

export default async function EditNutritionProgramPage({ params }: NutritionProgramParams) {
  const supabase = createClient();
  const programId = params.programId;

  // Verify user and coach role
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: coachProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!coachProfile || coachProfile.role !== 'coach') redirect('/dashboard');

  // Fetch the specific nutrition program template
  const { data: program, error: programError } = await supabase
    .from('nutrition_program_templates')
    .select('*') // Select all columns
    .eq('id', programId)
    .eq('coach_id', user.id) // Ensure coach owns this template
    .single();

  if (programError || !program) {
    console.error('Error fetching nutrition program:', programError);
    // Redirect to programs list if not found or error
    redirect('/coach/nutrition/programs?error=Program not found or access denied.');
  }

  // Note: No longer fetching mealsWithItems here as it's handled by the structure page

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6"> {/* Adjusted padding and added spacing */}
      {/* Replace Back link with Done button */}
      <div className="flex justify-start mb-4"> {/* Container for positioning */}
        <Link href="/coach/nutrition/programs">
          <Button variant="outline">Done</Button> {/* Use Button component */}
        </Link>
      </div>

      <AuthMessages />

      {/* Pass only program data and the details update action */}
      {/* Removed the extra div wrapper */}
      <NutritionProgramEditor
        program={program as ProgramTemplate} // Cast to ensure type match, ideally Database type works
        updateProgramDetailsAction={updateNutritionProgramTemplateDetails}
      />

    </div>
  );
}
