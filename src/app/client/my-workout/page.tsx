import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import React from 'react'; // Import React for Fragment
import WorkoutItemLogger from '@/app/client/WorkoutItemLogger'; // Use alias path

// Define types (can be shared/refined later)
type ExerciseDetails = {
    id: string;
    name: string;
    description: string | null;
    instructions: string | null;
    video_url: string | null;
};
// Define type for workout logs fetched from DB
type WorkoutLog = {
    id: string;
    set_number: number;
    reps_completed: number | null;
     weight_used: number | null;
     weight_unit: string | null;
     duration_seconds: number | null;
     rest_taken_seconds: number | null; // Added missing field
     notes: string | null;
     logged_at: string;
    exercise_id: string; // Keep exercise_id for matching
};
type WorkoutItemDetails = {
    id: string; // ID of the item itself
    exercise_id: string;
    item_order: number;
    sets: string | null;
    reps: string | null;
    rest_period: string | null;
    notes: string | null;
     group_id: number | null;
     group_order: number | null;
     alternative_exercise_id: string | null; // Added alternative ID
     exercises: ExerciseDetails[] | null; // Primary exercise details
     alternativeExercise?: ExerciseDetails | null; // Alternative exercise details
     // Add logs to the item type
     logs?: WorkoutLog[];
}; // Added missing closing brace and semicolon

type AssignedWorkout = {
    id: string;
    name: string;
    notes: string | null;
    assigned_date: string;
    workout_template_id: string | null;
};

export default async function MyWorkoutPage() {
    console.log("--- Loading MyWorkoutPage ---");
    const supabase = createClient();
    let workoutItems: WorkoutItemDetails[] = [];
    let displayError: string | null = null;

    // 1. Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
        console.error("Error getting user:", userError);
        redirect('/login?error=Could not get user session');
    }
    if (!user) {
        console.log("No user found, redirecting to login.");
        redirect('/login');
    }
    console.log("User ID:", user.id);

    // 2. Verify client role
    const { data: clientProfile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profileError) {
        console.error("Error fetching client profile:", profileError);
        displayError = "Error fetching user profile.";
    } else if (!clientProfile || clientProfile.role !== 'client') {
        console.log("User is not a client or profile not found, redirecting.");
        redirect('/dashboard');
    } else {
         console.log("Client profile verified.");
    }

    // 3. Fetch workout assigned for today
    const today = format(new Date(), 'yyyy-MM-dd');
    console.log("Fetching assigned workout for date:", today);

    const { data: workoutData, error: workoutError } = await supabase
        .from('assigned_workouts')
        .select(`id, name, notes, assigned_date, workout_template_id`)
        .eq('client_id', user.id)
        .eq('assigned_date', today)
        .order('created_at', { ascending: true });

    const assignedWorkout = workoutData?.[0] ?? null;

    if (workoutError && workoutError.code !== 'PGRST116') {
        console.error("Error fetching today's assigned workout:", workoutError);
        displayError = "Error fetching today's workout.";
    } else {
        console.log("Assigned workout data fetched (first one if multiple):", assignedWorkout);
    }

    // 4. Fetch items and logs if workout assigned
    if (!displayError && assignedWorkout && assignedWorkout.workout_template_id) {
        console.log(`Fetching items for template ID: ${assignedWorkout.workout_template_id}`);
        const { data: itemsData, error: fetchItemsError } = await supabase
            .from('workout_template_items')
            .select(`id, exercise_id, alternative_exercise_id, item_order, sets, reps, rest_period, notes, group_id, group_order`) // Added alternative_exercise_id
            .eq('template_id', assignedWorkout.workout_template_id)
            .order('item_order', { ascending: true });

        if (fetchItemsError) {
            console.error("Error fetching workout items:", fetchItemsError);
            displayError = "Error fetching workout items.";
        } else if (itemsData && itemsData.length > 0) {
            console.log(`Found ${itemsData.length} workout items. Fetching exercises and logs...`);
            // Collect all unique exercise IDs (primary and alternative)
            const exerciseIds = new Set<string>();
            itemsData.forEach(item => {
                if (item.exercise_id) exerciseIds.add(item.exercise_id); // Check if not null
                if (item.alternative_exercise_id) exerciseIds.add(item.alternative_exercise_id);
            });

            // Fetch exercise details and logs in parallel
            const [exerciseRes, logsRes] = await Promise.all([
                supabase.from('exercises').select('id, name, description, instructions, video_url').in('id', Array.from(exerciseIds)), // Fetch details for all IDs
                supabase.from('workout_logs').select('*').eq('assigned_workout_id', assignedWorkout.id) // Fetch all logs for this assignment
            ]);

            const { data: exerciseDetails, error: fetchExerciseError } = exerciseRes;
            const { data: workoutLogs, error: fetchLogsError } = logsRes;

            if (fetchExerciseError || fetchLogsError) {
                 console.error("Error fetching exercise details or logs:", fetchExerciseError || fetchLogsError);
                 displayError = "Error fetching exercise details or logs.";
            } else {
                console.log(`Successfully fetched details for ${exerciseDetails?.length ?? 0} exercises and ${workoutLogs?.length ?? 0} logs.`);
                const exerciseMap = new Map(exerciseDetails?.map(ex => [ex.id, ex]));
                const logsMap = new Map<string, WorkoutLog[]>(); // Map exercise_id to its logs
                workoutLogs?.forEach(log => {
                    // Ensure log.exercise_id is not null before using it as a key
                    if (log.exercise_id) {
                        const logs = logsMap.get(log.exercise_id) ?? [];
                        logs.push(log);
                        logsMap.set(log.exercise_id, logs);
                    }
                });

                // Combine item data with exercise details and logs
                 try {
                    workoutItems = itemsData.map(item => {
                        const foundExercise = item.exercise_id ? exerciseMap.get(item.exercise_id) : null; // Check if exercise_id exists
                        const foundAlternative = item.alternative_exercise_id ? exerciseMap.get(item.alternative_exercise_id) : null;
                        // Use item.exercise_id for logs, assuming logs are tied to the primary exercise ID even if alternative is chosen?
                        // Or should logs be tied to the currently selected exercise ID? Let's assume primary for now.
                        const itemLogs = item.exercise_id ? logsMap.get(item.exercise_id) ?? [] : [];
                        return {
                            ...item,
                            alternativeExercise: foundAlternative, // Add alternative details
                            exercises: foundExercise ? [foundExercise] : null,
                            logs: itemLogs // Add the fetched logs
                        };
                    }) as WorkoutItemDetails[]; // Cast needed because TS might not infer alternativeExercise correctly
                    console.log("Combined workout items:", workoutItems);
                 } catch (e) {
                     console.error("Error combining workout items:", e);
                     displayError = "Error processing workout data.";
                 }
            }
        } else {
             console.log("No workout items found for this template.");
             workoutItems = [];
        }
    } else if (!displayError && assignedWorkout) {
        console.log("Assigned workout found, but no template ID associated.");
    } else if (!displayError && !assignedWorkout) {
        console.log("No assigned workout found for today.");
    }

    const formattedToday = format(new Date(), 'PPP');

    return (
        <div className="container mx-auto p-8">
            <h1 className="mb-4 text-3xl font-bold">Today's Workout ({formattedToday})</h1>

            {displayError && (
                <p className="text-destructive">{displayError} Please try again.</p>
            )}

            {!displayError && !assignedWorkout && (
                <p className="text-muted-foreground">No workout assigned for today. Enjoy your rest day!</p>
            )}

            {!displayError && assignedWorkout && (
                <div className="space-y-8 rounded-lg border border-border bg-card p-6 shadow-lg">
                    <div>
                        <h2 className="text-2xl font-semibold">{assignedWorkout.name}</h2>
                        {assignedWorkout.notes && (
                            <p className="mt-1 text-muted-foreground">Coach's Notes: {assignedWorkout.notes}</p>
                        )}
                    </div>

                    {/* Correct variable name used in condition */}
                    {workoutItems.length === 0 && !displayError && ( // Only show if no items AND no error fetching items
                         <p className="text-muted-foreground">This workout template has no exercises yet.</p>
                    )}

                    {/* Display Workout Items using the Client Component */}
                    <div className="space-y-6">
                        {workoutItems.map((item, index) => (
                            <WorkoutItemLogger
                                key={item.id}
                                item={item}
                                index={index}
                                assignedWorkoutId={assignedWorkout.id}
                                // Pass logs down to the component
                                initialLogs={item.logs}
                            />
                        ))}
                    </div>
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
