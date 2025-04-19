import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import ExerciseListTable from './ExerciseListTable'; // Import the new client component

// Update type for exercises to include new fields
type Exercise = {
  id: string;
  name: string;
  body_part: string; // Added
  machine_type: string; // Added
  exercise_type: string; // Added Exercise Type
  description: string | null;
  video_url: string | null;
};

export default async function CoachExercisesPage() {
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

  // 2. Fetch exercises created by this coach, including new columns
  const { data: exercisesData, error: exercisesError } = await supabase
    .from('exercises')
    .select('id, name, body_part, machine_type, exercise_type, description, video_url') // Select exercise_type
    .eq('coach_id', user.id)
    .order('name', { ascending: true });

  // Ensure the fetched data matches the Exercise type, handling potential nulls if needed
  // Cast the data explicitly to ensure type safety, especially after adding a new required field
  const exercises: Exercise[] = (exercisesData as Exercise[]) || [];

  if (exercisesError) {
    console.error('Error fetching exercises:', exercisesError);
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Exercise Library</h1>
        <Link
          href="/coach/exercises/add"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          Add New Exercise
        </Link>
      </div>

      {exercisesError && (
        <p className="text-destructive">Error loading exercises. Please try again.</p>
      )}

      {!exercisesError && exercises && exercises.length === 0 && (
        <p className="text-muted-foreground">You haven't added any exercises to your library yet.</p>
      )}

      {/* Render the client component for the table */}
      {!exercisesError && exercises && exercises.length > 0 && (
         <ExerciseListTable exercises={exercises} />
      )}
       <div className="mt-8"> {/* Increased margin top */}
         <Link href="/dashboard" className="text-sm text-primary hover:underline">
           &larr; Back to Dashboard
         </Link>
       </div>
    </div>
  );
}
