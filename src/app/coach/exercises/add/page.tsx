import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import AuthMessages from '@/app/(auth)/AuthMessages';
import { addExercise } from '@/app/coach/actions'; // Import the action

// Define options for the dropdowns
const bodyPartOptions = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Abs', 'Calves', 'Forearms', 'Glutes', 'Full Body', 'Other'
];
const machineTypeOptions = [
  'Bodyweight', 'Machine', 'Cable', 'Free Weights', 'Dumbbell', 'Barbell', 'Kettlebell', 'Resistance Band', 'Cardio', 'Other'
];
const exerciseTypeOptions = [ // Added Exercise Type Options
  'Strength Training', 'Hypertrophy', 'Conditioning / HIIT', 'Cardio', 'Other'
];


export default async function AddExercisePage({
  searchParams,
}: {
  searchParams: { message?: string; error?: string };
}) {
  const supabase = createClient();

  // Verify user is logged in and is a coach
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: coachProfile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !coachProfile || coachProfile.role !== 'coach') {
    redirect('/dashboard'); // Redirect non-coaches
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="mb-6 text-3xl font-bold">Add New Exercise</h1>

      <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-8 shadow-lg">
        <AuthMessages />

        <form className="space-y-6" action={addExercise} >
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-muted-foreground">
              Exercise Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
              placeholder="e.g., Barbell Squat"
            />
          </div>

          {/* Body Part Dropdown */}
          <div>
            <label htmlFor="body_part" className="block text-sm font-medium text-muted-foreground">
              Body Part
            </label>
            <select
              id="body_part"
              name="body_part"
              required
              defaultValue="" // Ensure a default value is set for required selects
              className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
            >
              <option value="" disabled>Select a body part</option>
              {bodyPartOptions.map(part => (
                <option key={part} value={part}>{part}</option>
              ))}
            </select>
          </div>

          {/* Machine Type Dropdown */}
          <div>
            <label htmlFor="machine_type" className="block text-sm font-medium text-muted-foreground">
              Equipment / Type
            </label>
            <select
              id="machine_type"
              name="machine_type"
              required
              defaultValue="" // Ensure a default value is set for required selects
              className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
            >
              <option value="" disabled>Select equipment/type</option>
              {machineTypeOptions.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

           {/* Exercise Type Dropdown */}
           <div>
             <label htmlFor="exercise_type" className="block text-sm font-medium text-muted-foreground">
               Exercise Type
             </label>
             <select
               id="exercise_type"
               name="exercise_type"
               required
               defaultValue="" // Ensure a default value is set for required selects
               className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
             >
               <option value="" disabled>Select exercise type</option>
               {exerciseTypeOptions.map(type => (
                 <option key={type} value={type}>{type}</option>
               ))}
             </select>
           </div>


           <div>
            <label htmlFor="description" className="block text-sm font-medium text-muted-foreground">
              Description (Optional)
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
              placeholder="Brief description or key points"
            />
          </div>

           <div>
            <label htmlFor="instructions" className="block text-sm font-medium text-muted-foreground">
              Instructions / How-To (Optional)
            </label>
            <textarea
              id="instructions"
              name="instructions"
              rows={6}
              className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
              placeholder="Step-by-step instructions, form cues, etc."
            />
          </div>

           <div>
            <label htmlFor="videoUrl" className="block text-sm font-medium text-muted-foreground">
              Video URL (Optional, e.g., YouTube link)
            </label>
            <input
              id="videoUrl"
              name="videoUrl"
              type="url"
              className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
              placeholder="https://www.youtube.com/watch?v=..."
            />
          </div>


          <div className="flex justify-end space-x-4 pt-4">
             <Link
               href="/coach/exercises"
               className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground shadow-sm hover:bg-muted/50"
             >
               Cancel
             </Link>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
            >
              Add Exercise
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
