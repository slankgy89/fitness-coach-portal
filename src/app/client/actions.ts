'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// Return type for actions that don't redirect
type ActionResult = { success: boolean; error?: string; message?: string };

// Define type for workout logs returned by actions
type WorkoutLog = {
    id: string;
    set_number: number;
    reps_completed: number | null;
    weight_used: number | null;
    weight_unit: string | null;
    duration_seconds: number | null; // Duration of the exercise itself
    rest_taken_seconds: number | null; // Rest taken *after* this set
    notes: string | null;
    logged_at: string;
    exercise_id: string;
    assigned_workout_id: string;
    client_id: string; // Added client_id here
};


export async function bookSlot(formData: FormData) {
  const supabase = createClient();
  const slotId = formData.get('slotId') as string;

  // 1. Get current user (the client)
  const { data: { user: clientUser } } = await supabase.auth.getUser();
  if (!clientUser) {
    return redirect('/login');
  }

   // 2. Get client's profile to verify role and coach assignment
  const { data: clientProfile } = await supabase
    .from('profiles')
    .select('role, coach_id')
    .eq('id', clientUser.id)
    .single();

  if (!clientProfile || clientProfile.role !== 'client' || !clientProfile.coach_id) {
    // Not a client or no coach assigned
    return redirect('/dashboard?error=Booking requires an assigned coach.');
  }

  if (!slotId) {
    return redirect('/client/booking?error=Invalid slot selected.');
  }

  // 3. Fetch the selected slot details AND count current bookings for it
  const { data: slotData, error: slotError } = await supabase
    .from('schedule_slots')
    .select(`
      id, start_time, max_attendees, coach_id,
      bookings ( count )
    `)
    .eq('id', slotId)
    .gte('start_time', new Date().toISOString()) // Ensure slot is in the future
    .single(); // Expecting only one slot

  if (slotError || !slotData) {
    console.error("Error fetching slot or slot not found/in past:", slotError);
    return redirect('/client/booking?error=Selected slot is unavailable or invalid.');
  }

  // Verify slot belongs to the client's coach
  if (slotData.coach_id !== clientProfile.coach_id) {
     return redirect('/client/booking?error=Cannot book slot from a different coach.');
  }

  // 4. Check if slot is full
  const currentBookings = slotData.bookings[0]?.count ?? 0;
  if (currentBookings >= slotData.max_attendees) {
    return redirect('/client/booking?error=Sorry, this slot is now fully booked.');
  }

  // 5. Check if client already booked this slot
  const { count: existingBookingCount, error: existingBookingError } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientUser.id)
    .eq('slot_id', slotId);

  if (existingBookingError) {
      console.error("Error checking existing booking:", existingBookingError);
      return redirect('/client/booking?error=Could not verify booking status.');
  }
  if (existingBookingCount && existingBookingCount > 0) {
      return redirect('/client/booking?message=You have already booked this slot.');
  }

  // 6. Create the booking
  const { error: insertError } = await supabase
    .from('bookings')
    .insert({
      client_id: clientUser.id,
      slot_id: slotId,
    });

  if (insertError) {
    console.error("Error creating booking:", insertError);
    return redirect(`/client/booking?error=Failed to book slot. ${insertError.message}`);
  }

  // 7. Revalidate and redirect
  revalidatePath('/client/booking');
  redirect('/client/booking?message=Slot booked successfully!');
}

export async function logWorkoutSet(formData: FormData): Promise<{ success?: boolean; error?: string; newLog?: WorkoutLog | null }> {
    const supabase = createClient();

    // 1. Get current user
    const { data: { user: clientUser } } = await supabase.auth.getUser();
    if (!clientUser) {
        console.error("User not authenticated for logging workout set.");
        return { error: "User not authenticated." };
    }

    // 2. Get form data
    const assignedWorkoutId = formData.get('assignedWorkoutId') as string;
    const exerciseId = formData.get('exerciseId') as string;
    const setNumber = parseInt(formData.get('setNumber') as string, 10);
    console.log("--- logWorkoutSet Action ---");
    console.log("Received assignedWorkoutId:", assignedWorkoutId);
    console.log("Received exerciseId:", exerciseId);
    console.log("Attempting log for user:", clientUser.id);
    const repsCompleted = formData.get('repsCompleted') ? parseInt(formData.get('repsCompleted') as string, 10) : null;
    const weightUsed = formData.get('weightUsed') ? parseFloat(formData.get('weightUsed') as string) : null;
    const weightUnit = formData.get('weightUnit') as string | null;
    const durationSeconds = formData.get('durationSeconds') ? parseInt(formData.get('durationSeconds') as string, 10) : null;
    const restTakenSeconds = formData.get('restTakenSeconds') ? parseInt(formData.get('restTakenSeconds') as string, 10) : null;
    const notes = formData.get('notes') as string | null;

    // Basic validation
    if (!assignedWorkoutId || !exerciseId || isNaN(setNumber) || setNumber < 1) {
        console.error("Invalid data for logging workout set:", { assignedWorkoutId, exerciseId, setNumber });
        return { error: "Invalid data provided." };
    }

    // 4. Insert into workout_logs table and select the result
    const { data: newLog, error: insertError } = await supabase
        .from('workout_logs')
        .insert({
            assigned_workout_id: assignedWorkoutId,
            exercise_id: exerciseId,
            set_number: setNumber,
            reps_completed: repsCompleted,
            weight_used: weightUsed,
            weight_unit: weightUnit || 'kg', // Default to kg if not provided
            duration_seconds: durationSeconds,
            rest_taken_seconds: restTakenSeconds, // Add rest taken
            notes: notes || null,
            client_id: clientUser.id // Add client_id to the insert
        })
        .select() // Select the newly inserted row
        .single(); // Expecting one row back

    if (insertError) {
        console.error("Error inserting workout log:", insertError);
        return { error: `Failed to log set. ${insertError.message}` };
    }

    // 5. Revalidate relevant paths and return the new log data
    revalidatePath(`/client/my-workout`);
    console.log("Successfully logged set:", newLog);
    return { success: true, newLog: newLog as WorkoutLog }; // Return the newly created log record
}

export async function updateWorkoutSet(formData: FormData): Promise<{ success?: boolean; error?: string; updatedLog?: WorkoutLog | null }> {
    const supabase = createClient();

    // 1. Get current user
    const { data: { user: clientUser } } = await supabase.auth.getUser();
    if (!clientUser) {
        return { error: "User not authenticated." };
    }

    // 2. Get form data
    const logId = formData.get('logId') as string;
    const setNumber = parseInt(formData.get('setNumber') as string, 10); // Needed for message
    const repsCompleted = formData.get('repsCompleted') ? parseInt(formData.get('repsCompleted') as string, 10) : null;
    const weightUsed = formData.get('weightUsed') ? parseFloat(formData.get('weightUsed') as string) : null;
    const weightUnit = formData.get('weightUnit') as string | null;
    const durationSeconds = formData.get('durationSeconds') ? parseInt(formData.get('durationSeconds') as string, 10) : null;
    const restTakenSeconds = formData.get('restTakenSeconds') ? parseInt(formData.get('restTakenSeconds') as string, 10) : null;
    const notes = formData.get('notes') as string | null;

    // Basic validation - allow updating only duration/rest without reps/weight
    if (!logId) {
        console.error("Invalid data for updating workout set: Missing logId");
        return { error: "Invalid data provided for update (missing ID)." };
    }
    // Ensure at least *something* is being logged (reps/weight OR duration)
    if (repsCompleted === null && durationSeconds === null) {
         console.error("Invalid data for updating workout set: No reps or duration provided.");
         return { error: "Please provide reps or duration to update." };
    }
    // If reps are provided, weight and unit must also be provided
    if (repsCompleted !== null && (weightUsed === null || !weightUnit)) {
         console.error("Invalid data for updating workout set: Missing weight/unit for reps.");
         return { error: "Please provide weight and unit when updating reps." };
    }

    // 3. Verify user owns the log they are trying to update
    const { data: logData, error: logFetchError } = await supabase
        .from('workout_logs')
        .select('client_id') // Select client_id directly from the log
        .eq('id', logId)
        .single();

    if (logFetchError || !logData) {
        console.error("Error fetching log or log not found:", logFetchError);
        return { error: "Log entry not found." };
    }
    // Re-check if client_id exists on logData before comparing
    if (!logData.client_id || logData.client_id !== clientUser.id) {
         console.error("Log update permission error: User does not own log or client_id missing.");
         return { error: "Permission denied to update this log." };
    }


    // 4. Update the workout_logs table and select the result
    const { data: updatedLogData, error: updateError } = await supabase
        .from('workout_logs')
        .update({
            reps_completed: repsCompleted,
            weight_used: weightUsed,
            weight_unit: weightUnit,
            duration_seconds: durationSeconds,
            rest_taken_seconds: restTakenSeconds,
            notes: notes || null,
            logged_at: new Date().toISOString(), // Update timestamp on edit
        })
        .eq('id', logId)
        .select() // Select the updated row
        .single(); // Expecting one row back

    if (updateError) {
        console.error("Error updating workout log:", updateError);
        return { error: `Failed to update set log. ${updateError.message}` };
    }

    // 5. Revalidate and return the updated log data
    revalidatePath(`/client/my-workout`);
    console.log("Successfully updated set:", updatedLogData);
    return { success: true, updatedLog: updatedLogData as WorkoutLog }; // Return the updated log record
}


export async function agreeToDocument(formData: FormData) {
  const supabase = createClient();
  const documentId = formData.get('documentId') as string;
  const documentVersion = parseInt(formData.get('documentVersion') as string, 10);
  const agreed = formData.get('agree') === 'on'; // Checkbox value is 'on' if checked

  // 1. Get current user (the client)
  const { data: { user: clientUser } } = await supabase.auth.getUser();
  if (!clientUser) {
    return redirect('/login');
  }

  // Basic validation
  if (!agreed) {
    return redirect('/client/documents?error=You must check the box to agree.');
  }
  if (!documentId || isNaN(documentVersion)) {
     return redirect('/client/documents?error=Invalid document information.');
  }

   // 4. Check if already agreed
   const { count: existingAgreementCount, error: checkError } = await supabase
    .from('document_agreements')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientUser.id)
    .eq('document_id', documentId)
    .eq('document_version', documentVersion);

   if (checkError) {
       console.error("Error checking existing agreement:", checkError);
       return redirect('/client/documents?error=Could not verify agreement status.');
   }
   if (existingAgreementCount && existingAgreementCount > 0) {
       revalidatePath('/client/documents');
       return redirect('/client/documents?message=Document already agreed to.');
   }

  // 5. Insert the agreement record
  const { error: insertError } = await supabase
    .from('document_agreements')
    .insert({
      client_id: clientUser.id,
      document_id: documentId,
      document_version: documentVersion,
    });

  if (insertError) {
    console.error("Error saving agreement:", insertError);
    if (insertError.code === '23505') {
         return redirect('/client/documents?message=Document already agreed to.');
    }
    return redirect(`/client/documents?error=Failed to save agreement. ${insertError.message}`);
  }

  // 6. Revalidate and redirect
  revalidatePath('/client/documents');
  redirect('/client/documents?message=Document agreement confirmed!');
}

// --- Nutrition Logging ---
export async function logFoodItem(formData: FormData): Promise<ActionResult> {
  const supabase = createClient();

  // 1. Get current user (client)
  const { data: { user: clientUser } } = await supabase.auth.getUser();
  if (!clientUser) {
    return { success: false, error: 'Authentication required.' };
  }

  // 2. Extract form data
  const foodId = formData.get('foodId') as string;
  const quantityStr = formData.get('quantity') as string;
  const unit = formData.get('unit') as string;
  const logDate = formData.get('logDate') as string;
  const mealName = formData.get('mealName') as string | null;
  const notes = formData.get('notes') as string | null;
  const coachId = formData.get('coachId') as string; // Passed from the form

  // Extract calculated nutrition values
  const caloriesStr = formData.get('calories') as string | null;
  const proteinStr = formData.get('protein_g') as string | null;
  const carbsStr = formData.get('carbs_g') as string | null;
  const fatStr = formData.get('fat_g') as string | null;

  // 3. Validate required fields
  if (!foodId || !quantityStr || !unit || !logDate || !coachId) {
    return { success: false, error: 'Missing required fields (food, quantity, unit, date, coach).' };
  }

  // Validate numeric fields
  const quantity = parseFloat(quantityStr);
  if (isNaN(quantity) || quantity <= 0) {
    return { success: false, error: 'Invalid quantity.' };
  }
  const calories = caloriesStr ? parseFloat(caloriesStr) : null;
  const protein_g = proteinStr ? parseFloat(proteinStr) : null;
  const carbs_g = carbsStr ? parseFloat(carbsStr) : null;
  const fat_g = fatStr ? parseFloat(fatStr) : null;

  // 4. Insert into nutrition_logs table
  const { error: insertError } = await supabase
    .from('nutrition_logs')
    .insert({
      client_id: clientUser.id,
      coach_id: coachId, // Store the coach_id
      log_date: logDate,
      meal_name: mealName || null,
      food_id: foodId,
      quantity: quantity,
      unit: unit,
      calories: calories,
      protein_g: protein_g,
      carbs_g: carbs_g,
      fat_g: fat_g,
      notes: notes || null,
    });

  if (insertError) {
    console.error('Error inserting nutrition log:', insertError);
    // Check for specific errors like foreign key violation if food_id is invalid
    if (insertError.code === '23503') {
        return { success: false, error: 'Invalid food item selected.' };
    }
    return { success: false, error: `Failed to log food item: ${insertError.message}` };
  }

  // 5. Revalidate relevant paths (optional, depends on where logs are displayed)
  // revalidatePath('/client/nutrition-summary'); // Example

  return { success: true, message: 'Food item logged successfully!' };
}
