import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

// Define type for workout templates
type WorkoutTemplate = {
  id: string;
  name: string;
  description: string | null;
  // Add fields for summary data
  itemCount?: number;
  totalSets?: number;
  totalReps?: number;
  totalWeightValue?: number; // Renamed for clarity (unitless sum)
  bodyParts?: string[];
  altCount?: number;
  supersetCount?: number;
};

// Define type for template items (matching WorkoutItemList)
type WorkoutItem = {
  id: string;
  template_id: string;
  exercise_id: string;
  alternative_exercise_id: string | null;
  superset_exercise_id?: string | null;
  sets: number | null;
  set_details: any | null; // Fetching set_details
};

// Define type for exercise details needed
type ExerciseDetail = {
    id: string;
    body_part: string | null;
};


export default async function CoachWorkoutsPage() {
  const supabase = createClient();

  // 1. Get current user & verify coach role
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

  // 2. Fetch workout templates created by this coach
  const { data: templates, error: templatesError } = await supabase
    .from('workout_templates')
    .select('id, name, description')
    .eq('coach_id', user.id)
    .order('name', { ascending: true });

  if (templatesError) {
    console.error('Error fetching workout templates:', templatesError);
    // Consider throwing error or showing specific message
  }

  let templatesWithSummary: WorkoutTemplate[] = templates || [];

  // 3. If templates exist, fetch items and exercise details
  if (templates && templates.length > 0) {
      const templateIds = templates.map(t => t.id);

      // Fetch all items for these templates, including set_details
      const { data: allItems, error: itemsError } = await supabase
          .from('workout_template_items')
          .select('id, template_id, exercise_id, alternative_exercise_id, superset_exercise_id, sets, set_details, alt_set_details, superset_set_details') // Fetch all details
          .in('template_id', templateIds);

      if (itemsError) {
          console.error('Error fetching template items:', itemsError);
          // Handle error - maybe show partial data or an error message
      } else if (allItems) {
          // Collect all unique exercise IDs needed
          const exerciseIds = new Set<string>();
          allItems.forEach(item => {
              if (item.exercise_id) exerciseIds.add(item.exercise_id);
              if (item.alternative_exercise_id) exerciseIds.add(item.alternative_exercise_id);
              if (item.superset_exercise_id) exerciseIds.add(item.superset_exercise_id);
          });

          // Fetch required exercise details
          let exerciseDetailsMap = new Map<string, ExerciseDetail>();
          if (exerciseIds.size > 0) {
              const { data: exerciseDetails, error: exercisesError } = await supabase
                  .from('exercises')
                  .select('id, body_part')
                  .in('id', Array.from(exerciseIds));

              if (exercisesError) {
                  console.error('Error fetching exercise details:', exercisesError);
                  // Handle error
              } else if (exerciseDetails) {
                  exerciseDetails.forEach(ex => exerciseDetailsMap.set(ex.id, ex));
              }
          }

          // Process and add summary to each template
          templatesWithSummary = templates.map(template => {
              const itemsForTemplate = allItems.filter(item => item.template_id === template.id);
              const itemCount = itemsForTemplate.length;
              let totalSets = 0;
              let totalReps = 0;
              let totalWeightValue = 0; // Initialize unitless weight sum
              let altCount = 0;
              let supersetCount = 0;
              const bodyPartsSet = new Set<string>();

              itemsForTemplate.forEach(item => {
                  totalSets += item.sets ?? 0;
                  if (item.alternative_exercise_id) altCount++;
                  if (item.superset_exercise_id) supersetCount++;
                  const exerciseDetail = exerciseDetailsMap.get(item.exercise_id);
                  if (exerciseDetail?.body_part) bodyPartsSet.add(exerciseDetail.body_part);
                  const altExerciseDetail = item.alternative_exercise_id ? exerciseDetailsMap.get(item.alternative_exercise_id) : null;
                   if (altExerciseDetail?.body_part) bodyPartsSet.add(altExerciseDetail.body_part);
                  const supersetExerciseDetail = item.superset_exercise_id ? exerciseDetailsMap.get(item.superset_exercise_id) : null;
                   if (supersetExerciseDetail?.body_part) bodyPartsSet.add(supersetExerciseDetail.body_part);

                  // Function to process set details (reps and weight) for a given details object
                  const processSetDetails = (detailsData: any) => {
                      if (!detailsData) return;
                      try {
                          const details = typeof detailsData === 'string' ? JSON.parse(detailsData) : detailsData;
                          if (Array.isArray(details)) {
                              details.forEach(set => {
                                  // Calculate Reps
                                  if (set && typeof set.reps === 'string') {
                                      const repString = set.reps.toLowerCase().trim();
                                      if (repString !== 'amrap') {
                                          const rangeMatch = repString.match(/^(\d+)\s*-\s*(\d+)/);
                                          const singleMatch = repString.match(/^(\d+)$/);
                                          if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
                                              totalReps += Math.round((parseInt(rangeMatch[1], 10) + parseInt(rangeMatch[2], 10)) / 2);
                                          } else if (singleMatch && singleMatch[1]) {
                                              totalReps += parseInt(singleMatch[1], 10);
                                          }
                                      }
                                      // AMRAP is skipped (counted as 0)
                                  }
                                  // Calculate Weight (summing numbers, ignoring units/BW)
                                  if (set && typeof set.weight === 'string') {
                                     const weightString = set.weight.toLowerCase().trim();
                                     // Match only the numerical part, ignoring units or 'bw'
                                     const weightMatch = weightString.match(/^(\d+(\.\d+)?)/);
                                     if (weightMatch && weightMatch[1]) {
                                         totalWeightValue += parseFloat(weightMatch[1]);
                                     }
                                 }
                              });
                          }
                      } catch (e) {
                          console.warn(`Failed to parse set_details for item ${item.id}:`, e);
                      }
                  };

                  // Process primary, alternative, and superset details
                  processSetDetails(item.set_details);
                  if (item.alternative_exercise_id) {
                      processSetDetails(item.alt_set_details);
                  }
                  if (item.superset_exercise_id) {
                      processSetDetails(item.superset_set_details);
                  }
              });

              return {
                  ...template,
                  itemCount: itemCount,
                  totalSets: totalSets,
                  totalReps: totalReps,
                  totalWeightValue: Math.round(totalWeightValue), // Round the final sum
                  bodyParts: Array.from(bodyPartsSet).sort(),
                  altCount: altCount,
                  supersetCount: supersetCount,
              };
          });
      }
  }


  return (
    <div className="container mx-auto p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Workout Templates</h1>
        <Link
          href="/coach/workouts/add"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          Create New Template
        </Link>
      </div>

      {templatesError && (
        <p className="text-destructive">Error loading templates. Please try again.</p>
      )}

      {!templatesError && templatesWithSummary && templatesWithSummary.length === 0 && (
        <p className="text-muted-foreground">You haven't created any workout templates yet.</p>
      )}

      {!templatesError && templatesWithSummary && templatesWithSummary.length > 0 && (
        <div className="space-y-4">
            {templatesWithSummary.map((template) => (
              <div key={template.id} className="rounded-lg border border-border bg-card p-4 shadow">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">{template.name}</h2>
                        {/* Display Summary Info */}
                        <div className="mt-1 text-xs text-muted-foreground space-x-2 flex flex-wrap items-center">
                            <span>{template.itemCount ?? 0} Exercises</span>
                            <span className="text-muted-foreground/50">|</span>
                            <span>{template.totalSets ?? 0} Total Sets</span>
                            <span className="text-muted-foreground/50">|</span>
                            <span>{template.totalReps ?? 0} Total Reps</span>
                            {(template.totalWeightValue ?? 0) > 0 && ( // Check if weight value exists
                                <>
                                    <span className="text-muted-foreground/50">|</span>
                                    <span>{template.totalWeightValue} Total Weight (Kg/Lbs)</span> {/* Updated Label */}
                                </>
                            )}
                            {template.bodyParts && template.bodyParts.length > 0 && (
                                <>
                                    <span className="text-muted-foreground/50">|</span>
                                    <span>Body Parts: {template.bodyParts.join(', ')}</span>
                                </>
                            )}
                             {(template.altCount ?? 0) > 0 && (
                                <>
                                    <span className="text-muted-foreground/50">|</span>
                                    <span>Alternates: {template.altCount}</span>
                                </>
                            )}
                             {(template.supersetCount ?? 0) > 0 && (
                                <>
                                    <span className="text-muted-foreground/50">|</span>
                                    <span>Supersets: {template.supersetCount}</span>
                                </>
                            )}
                        </div>
                        {template.description && (
                            <p className="mt-2 text-sm text-muted-foreground">{template.description}</p>
                        )}
                    </div>
                    <Link href={`/coach/workouts/${template.id}/edit`} className="text-sm text-primary hover:underline whitespace-nowrap ml-4"> {/* Added margin */}
                      Edit / View
                    </Link>
                </div>
              </div>
            ))}
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
