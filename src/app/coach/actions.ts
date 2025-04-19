'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { Database, Json } from '@/lib/database.types'; // Import Database and Json types

// Return type for actions that don't redirect
type ActionResult = { success: boolean; error?: string; message?: string };

// Define type for schedule slots (needed for bookSlot)
type ScheduleSlot = {
  id: string;
  start_time: string;
  coach_id: string;
  max_attendees: number;
  bookings: { count: number }[];
};

// Define the Supplement type (if not already globally defined)
export interface Supplement {
    id: string; // Use UUID for unique identification
    name: string;
    dosage: string;
    notes: string | null;
}

// Define and export the expected shape of the updates object for the database
export type NutritionProgramTemplateUpdates = Partial<{
  name: string | null;
  description: string | null;
  category: string | null;
  calorie_target_type: 'fixed' | 'deficit' | null;
  min_calories: number | null;
  max_calories: number | null;
  min_protein_grams: number | null;
  max_protein_grams: number | null;
  min_carb_grams: number | null;
  max_carb_grams: number | null;
  min_fat_grams: number | null;
  max_fat_grams: number | null;
  min_sugar_grams: number | null;
  max_sugar_grams: number | null;
  target_meals_per_day: number | null;
  duration_value: number | null;
  duration_unit: 'days' | 'weeks' | 'months' | null;
  supplements: Supplement[] | null;
}>;

// Define a minimal type for the returned meal
type NewMealData = {
    id: string;
    program_template_id: string;
    day_number: number;
    meal_name: string;
    meal_order: number;
    created_at: string;
    updated_at: string;
    nutrition_program_meal_items: []; // Start with empty items
};

// Define expected structure for meal data with nested template coach_id
interface MealWithTemplateCoach {
    id: string;
    program_template_id: string;
    nutrition_program_templates: {
        coach_id: string;
    } | null;
}

// Define expected structure for item data with nested meal/template coach_id
interface ItemWithMealTemplateCoach {
    id: string;
    meal_id: string;
    nutrition_program_meals: {
        program_template_id: string;
        nutrition_program_templates: {
            coach_id: string;
        } | null;
    } | null;
}

// Define type for the data structure being inserted into the 'foods' table
interface FoodInsertData {
  coach_id: string;
  fdc_id?: number | null; // Make optional for manual
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
  full_nutrients?: any; // Add full_nutrients field (JSONB)
}

// Define a type for the nutrient object within the USDA API response
interface UsdaNutrient {
  nutrient: {
    id: number;
    number: string;
    name: string;
    rank: number;
    unitName: string;
  };
  type: string;
  amount?: number; // Amount might be optional
  id?: number; // Sometimes there's an ID here too
  foodNutrientDerivation?: {
      code: string;
      description: string;
      foodNutrientSource: {
          id: number;
          code: string;
          description: string;
      };
  };
}

// Helper function to find nutrient value by number/ID
const findNutrient = (nutrients: UsdaNutrient[], nutrientId: number): number | null => {
  const nutrient = nutrients.find(n => n.nutrient.id === nutrientId);
  return nutrient?.amount ?? null;
};

// Helper to check coach ownership of a program template
async function verifyCoachOwnsProgram(supabase: ReturnType<typeof createClient>, programId: string, coachId: string): Promise<boolean> {
    const { count, error } = await supabase
        .from('nutrition_program_templates')
        .select('*', { count: 'exact', head: true })
        .eq('id', programId)
        .eq('coach_id', coachId);
    if (error || count === 0) {
        console.error("Verification failed: Coach does not own program or program not found.", { programId, coachId, error });
        return false;
    }
    return true;
}

// Helper to verify coach owns the meal (and thus the template)
async function verifyCoachOwnsMeal(supabase: ReturnType<typeof createClient>, mealId: string, coachId: string): Promise<{ owns: boolean, programId?: string }> {
    const { data: mealData, error } = await supabase
        .from('nutrition_program_meals')
        .select(`program_template_id, nutrition_program_templates ( coach_id )`)
        .eq('id', mealId)
        .single<MealWithTemplateCoach>(); // Explicitly type the result

    // Type guard with explicit typing applied
    if (error || !mealData || !mealData.nutrition_program_templates || mealData.nutrition_program_templates.coach_id !== coachId) {
        console.error("Verification failed: Coach does not own meal, meal not found, or template data invalid.", { mealId, coachId, error, mealData });
        return { owns: false };
    }
    return { owns: true, programId: mealData.program_template_id };
}


// --- Client Management ---
export async function addClient(formData: FormData) {
  const supabase = createClient();
  const clientEmail = formData.get('email') as string;
  const { data: { user: coachUser } } = await supabase.auth.getUser();
  if (!coachUser) return redirect('/login');
  const { data: coachProfile } = await supabase.from('profiles').select('role').eq('id', coachUser.id).single();
  if (!coachProfile || coachProfile.role !== 'coach') return redirect('/dashboard?error=Unauthorized');
  const { data: clientProfile, error: findError } = await supabase.from('profiles').select('id, coach_id').eq('email', clientEmail).single();
  if (findError || !clientProfile) return redirect('/coach/clients/add?error=Client email not found or user does not exist.');
  if (clientProfile.coach_id && clientProfile.coach_id !== coachUser.id) return redirect(`/coach/clients/add?error=Client is already assigned to another coach.`);
  if (clientProfile.coach_id === coachUser.id) return redirect(`/coach/clients/add?message=Client is already assigned to you.`);
  const { error: updateError } = await supabase.from('profiles').update({ coach_id: coachUser.id }).eq('id', clientProfile.id);
  if (updateError) return redirect(`/coach/clients/add?error=Failed to assign coach to client.`);
  revalidatePath('/coach/clients');
  redirect('/coach/clients?message=Client added successfully!');
}

// --- Schedule Management ---
export async function addScheduleSlot(formData: FormData) {
  const supabase = createClient();
  const { data: { user: coachUser } } = await supabase.auth.getUser();
  if (!coachUser) return redirect('/login');
  const { data: coachProfile } = await supabase.from('profiles').select('role').eq('id', coachUser.id).single();
  if (!coachProfile || coachProfile.role !== 'coach') return redirect('/dashboard?error=Unauthorized');
  const date = formData.get('date') as string;
  const startTime = formData.get('startTime') as string;
  const endTime = formData.get('endTime') as string;
  const slotType = formData.get('slotType') as string;
  const title = formData.get('title') as string | null;
  const maxAttendees = parseInt(formData.get('maxAttendees') as string, 10);
  if (!date || !startTime || !endTime || !slotType || isNaN(maxAttendees) || maxAttendees < 1) return redirect('/coach/schedule/add?error=Invalid schedule form data.');
  const startDateTimeISO = `${date}T${startTime}:00`;
  const endDateTimeISO = `${date}T${endTime}:00`;
  if (new Date(endDateTimeISO) <= new Date(startDateTimeISO)) return redirect('/coach/schedule/add?error=End time must be after start time.');
  const { error: insertError } = await supabase.from('schedule_slots').insert({ coach_id: coachUser.id, start_time: startDateTimeISO, end_time: endDateTimeISO, slot_type: slotType, title: title || null, max_attendees: maxAttendees });
  if (insertError) return redirect(`/coach/schedule/add?error=Failed to add schedule slot. ${insertError.message}`);
  revalidatePath('/coach/schedule');
  redirect('/coach/schedule?message=Schedule slot added successfully!');
}

// --- Document Management ---
export async function addDocument(formData: FormData) {
  const supabase = createClient();
  const { data: { user: coachUser } } = await supabase.auth.getUser();
  if (!coachUser) return redirect('/login');
  const { data: coachProfile } = await supabase.from('profiles').select('role').eq('id', coachUser.id).single();
  if (!coachProfile || coachProfile.role !== 'coach') return redirect('/dashboard?error=Unauthorized');
  const title = formData.get('title') as string;
  const content = formData.get('content') as string;
  const isActive = formData.get('isActive') === 'on';
  if (!title || !content) return redirect('/coach/documents/add?error=Title and content are required.');
  const { error: insertError } = await supabase.from('documents').insert({ coach_id: coachUser.id, title: title, content: content, is_active: isActive });
  if (insertError) return redirect(`/coach/documents/add?error=Failed to create document. ${insertError.message}`);
  revalidatePath('/coach/documents');
  redirect('/coach/documents?message=Document created successfully!');
}

// --- Exercise Management ---
export async function addExercise(formData: FormData) {
  const supabase = createClient();
  const { data: { user: coachUser } } = await supabase.auth.getUser();
  if (!coachUser) return redirect('/login');
  const { data: coachProfile } = await supabase.from('profiles').select('role').eq('id', coachUser.id).single();
  if (!coachProfile || coachProfile.role !== 'coach') return redirect('/dashboard?error=Unauthorized');
  const name = formData.get('name') as string;
  const body_part = formData.get('body_part') as string;
  const machine_type = formData.get('machine_type') as string;
  const exercise_type = formData.get('exercise_type') as string;
  const description = formData.get('description') as string | null;
  const instructions = formData.get('instructions') as string | null;
  const videoUrl = formData.get('videoUrl') as string | null;
  if (!name || !body_part || !machine_type || !exercise_type) return redirect('/coach/exercises/add?error=Name, Body Part, Equipment/Type, and Exercise Type are required.');
  if (videoUrl && videoUrl.trim() !== '' && !videoUrl.startsWith('http')) return redirect('/coach/exercises/add?error=Invalid video URL format.');
  const { error: insertError } = await supabase.from('exercises').insert({ coach_id: coachUser.id, name: name, body_part: body_part, machine_type: machine_type, exercise_type: exercise_type, description: description || null, instructions: instructions || null, video_url: videoUrl && videoUrl.trim() !== '' ? videoUrl : null });
  if (insertError) return redirect(`/coach/exercises/add?error=Failed to add exercise. ${insertError.message}`);
  revalidatePath('/coach/exercises');
  redirect('/coach/exercises?message=Exercise added successfully!');
}

export async function updateExercise(exerciseId: string, formData: FormData) {
  const supabase = createClient();
  const { data: { user: coachUser } } = await supabase.auth.getUser();
  if (!coachUser) return redirect('/login');
  const { data: coachProfile } = await supabase.from('profiles').select('role').eq('id', coachUser.id).single();
  if (!coachProfile || coachProfile.role !== 'coach') return redirect('/dashboard?error=Unauthorized');
  const name = formData.get('name') as string;
  const body_part = formData.get('body_part') as string;
  const machine_type = formData.get('machine_type') as string;
  const exercise_type = formData.get('exercise_type') as string;
  const description = formData.get('description') as string | null;
  const instructions = formData.get('instructions') as string | null;
  const videoUrl = formData.get('videoUrl') as string | null;
  if (!name || !body_part || !machine_type || !exercise_type) return redirect(`/coach/exercises/${exerciseId}/edit?error=Name, Body Part, Equipment/Type, and Exercise Type are required.`);
  if (videoUrl && videoUrl.trim() !== '' && !videoUrl.startsWith('http')) return redirect(`/coach/exercises/${exerciseId}/edit?error=Invalid video URL format.`);
  const { error: updateError } = await supabase.from('exercises').update({ name: name, body_part: body_part, machine_type: machine_type, exercise_type: exercise_type, description: description || null, instructions: instructions || null, video_url: videoUrl && videoUrl.trim() !== '' ? videoUrl : null }).eq('id', exerciseId).eq('coach_id', coachUser.id);
  if (updateError) return redirect(`/coach/exercises/${exerciseId}/edit?error=Failed to update exercise. ${updateError.message}`);
  revalidatePath('/coach/exercises');
  revalidatePath(`/coach/exercises/${exerciseId}/edit`);
  redirect('/coach/exercises?message=Exercise updated successfully!');
}

export async function deleteExercise(exerciseId: string) {
  const supabase = createClient();
  const { data: { user: coachUser } } = await supabase.auth.getUser();
  if (!coachUser) return redirect('/login');
  const { data: coachProfile } = await supabase.from('profiles').select('role').eq('id', coachUser.id).single();
  if (!coachProfile || coachProfile.role !== 'coach') return redirect('/dashboard?error=Unauthorized');
  const { error: deleteError } = await supabase.from('exercises').delete().eq('id', exerciseId).eq('coach_id', coachUser.id);
  if (deleteError) return redirect(`/coach/exercises?error=Failed to delete exercise. It might be in use in a workout template.`);
  revalidatePath('/coach/exercises');
  redirect('/coach/exercises?message=Exercise deleted successfully!');
}

export async function deleteMultipleExercises(exerciseIds: string[]) {
  if (!exerciseIds || exerciseIds.length === 0) return redirect('/coach/exercises?error=No exercises selected for deletion.');
  const supabase = createClient();
  const { data: { user: coachUser } } = await supabase.auth.getUser();
  if (!coachUser) return redirect('/login');
  const { data: coachProfile } = await supabase.from('profiles').select('role').eq('id', coachUser.id).single();
  if (!coachProfile || coachProfile.role !== 'coach') return redirect('/dashboard?error=Unauthorized');
  const { error: deleteError } = await supabase.from('exercises').delete().in('id', exerciseIds).eq('coach_id', coachUser.id);
  if (deleteError) return redirect(`/coach/exercises?error=Failed to delete some or all selected exercises. They might be in use.`);
  const count = exerciseIds.length;
  revalidatePath('/coach/exercises');
  redirect(`/coach/exercises?message=${count} exercise${count > 1 ? 's' : ''} deleted successfully!`);
}

// --- Workout Template Management ---
export async function addWorkoutTemplate(formData: FormData) {
  const supabase = createClient();
  const { data: { user: coachUser } } = await supabase.auth.getUser();
  if (!coachUser) return redirect('/login');
  const { data: coachProfile } = await supabase.from('profiles').select('role').eq('id', coachUser.id).single();
  if (!coachProfile || coachProfile.role !== 'coach') return redirect('/dashboard?error=Unauthorized');
  const name = formData.get('name') as string;
  const description = formData.get('description') as string | null;
  if (!name) return redirect('/coach/workouts/add?error=Template name is required.');
  const { data: newTemplate, error: insertError } = await supabase.from('workout_templates').insert({ coach_id: coachUser.id, name: name, description: description || null }).select('id').single();
  if (insertError || !newTemplate) return redirect(`/coach/workouts/add?error=Failed to create template. ${insertError?.message}`);
  revalidatePath('/coach/workouts');
  redirect(`/coach/workouts/${newTemplate.id}/edit?message=Template created. Now add exercises.`);
}

export async function updateWorkoutTemplateDetails(templateId: string, updates: { name?: string; description?: string | null }): Promise<ActionResult> {
  if (!templateId || !updates || (updates.name === undefined && updates.description === undefined)) return { success: false, error: 'Invalid arguments for update.' };
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Authentication required.' };
  const { data: templateOwner, error: ownerCheckError } = await supabase.from('workout_templates').select('coach_id').eq('id', templateId).single();
  if (ownerCheckError || !templateOwner || templateOwner.coach_id !== user.id) return { success: false, error: 'Template not found or permission denied.' };
  const dataToUpdate: { name?: string; description?: string | null } = {};
  if (updates.name !== undefined) dataToUpdate.name = updates.name;
   if (updates.description !== undefined) dataToUpdate.description = updates.description === '' ? null : updates.description;
   if (Object.keys(dataToUpdate).length === 0) return { success: true, message: 'No changes detected.' };
  const { error: updateError } = await supabase.from('workout_templates').update(dataToUpdate).eq('id', templateId);
  if (updateError) return { success: false, error: `Failed to update template: ${updateError.message}` };
  revalidatePath('/coach/workouts');
  revalidatePath(`/coach/workouts/${templateId}/edit`);
  return { success: true, message: 'Template details updated.' };
}

// --- Workout Template Item Management ---
export async function addWorkoutItem(formData: FormData) {
    const supabase = createClient();
    const { data: { user: coachUser } } = await supabase.auth.getUser();
    if (!coachUser) return redirect('/login');
    const { data: coachProfile } = await supabase.from('profiles').select('role').eq('id', coachUser.id).single();
    if (!coachProfile || coachProfile.role !== 'coach') return redirect('/dashboard?error=Unauthorized');
    const templateId = formData.get('templateId') as string;
    const exerciseId = formData.get('exerciseId') as string;
    const alternativeExerciseId = formData.get('alternativeExerciseId') as string || null;
    const setsCount = parseInt(formData.get('sets') as string, 10);
    const setDetailsString = formData.get('set_details') as string;
    const altSetDetailsString = formData.get('alt_set_details') as string | null;
    const supersetExerciseId = formData.get('supersetExerciseId') as string | null;
    const supersetSetDetailsString = formData.get('superset_set_details') as string | null;
    const notes = formData.get('notes') as string | null;
    if (!templateId || !exerciseId || isNaN(setsCount) || setsCount <= 0 || !setDetailsString) return redirect(`/coach/workouts/${templateId}/edit?error=Missing required fields (template, exercise, sets, details).`);
    if (alternativeExerciseId && !altSetDetailsString) return redirect(`/coach/workouts/${templateId}/edit?error=Alternative set details are required.`);
    if (supersetExerciseId && !supersetSetDetailsString) return redirect(`/coach/workouts/${templateId}/edit?error=Superset set details are required.`);
    let nextOrder = 1;
    try { const { data: lastItem, error: orderError } = await supabase.from('workout_template_items').select('item_order').eq('template_id', templateId).order('item_order', { ascending: false }).limit(1).maybeSingle(); if (orderError) throw orderError; if (lastItem) nextOrder = (lastItem.item_order ?? 0) + 1; } catch(e) { return redirect(`/coach/workouts/${templateId}/edit?error=Could not determine item order.`); }
    let setDetailsJson: any, altSetDetailsJson: any | null = null, supersetSetDetailsJson: any | null = null;
    try { setDetailsJson = JSON.parse(setDetailsString); if (!Array.isArray(setDetailsJson) || setDetailsJson.length !== setsCount) throw new Error('Primary set details count mismatch.'); if (alternativeExerciseId && altSetDetailsString) { altSetDetailsJson = JSON.parse(altSetDetailsString); if (!Array.isArray(altSetDetailsJson) || altSetDetailsJson.length !== setsCount) throw new Error('Alternative set details count mismatch.'); } if (supersetExerciseId && supersetSetDetailsString) { supersetSetDetailsJson = JSON.parse(supersetSetDetailsString); if (!Array.isArray(supersetSetDetailsJson) || supersetSetDetailsJson.length !== setsCount) throw new Error('Superset set details count mismatch.'); } } catch (e) { return redirect(`/coach/workouts/${templateId}/edit?error=Invalid set details format: ${e instanceof Error ? e.message : String(e)}`); }
    const { error: insertError } = await supabase.from('workout_template_items').insert({ template_id: templateId, exercise_id: exerciseId, alternative_exercise_id: alternativeExerciseId || null, superset_exercise_id: supersetExerciseId || null, item_order: nextOrder, sets: setsCount, set_details: setDetailsJson, alt_set_details: altSetDetailsJson, superset_set_details: supersetSetDetailsJson, notes: notes });
    if (insertError) return redirect(`/coach/workouts/${templateId}/edit?error=Database error: ${insertError.message}`);
    try { revalidateTag(`template-items-${templateId}`); } catch (revalError) { return redirect(`/coach/workouts/${templateId}/edit?message=Exercise added, but revalidation might have failed.`); }
    redirect(`/coach/workouts/${templateId}/edit?message=Exercise added successfully.`);
}

export async function updateWorkoutItem(itemId: string, templateId: string, formData: FormData): Promise<ActionResult> {
   if (!itemId || !templateId) return { success: false, error: 'Invalid request arguments.' };
   const supabase = createClient();
  const { data: { user: coachUser } } = await supabase.auth.getUser();
  if (!coachUser) return redirect('/login');
  const { data: coachProfile } = await supabase.from('profiles').select('role').eq('id', coachUser.id).single();
  if (!coachProfile || coachProfile.role !== 'coach') return { success: false, error: 'Unauthorized.' };
   const { count, error: checkError } = await supabase.from('workout_template_items').select(`id, workout_templates ( coach_id )`, { count: 'exact', head: true }).eq('id', itemId).eq('workout_templates.coach_id', coachUser.id);
  if (checkError || count === 0) return { success: false, error: 'Workout item not found or permission denied.' };
  const exerciseId = formData.get('exerciseId') as string;
  const alternativeExerciseId = formData.get('alternativeExerciseId') as string || null;
  const supersetExerciseId = formData.get('supersetExerciseId') as string || null;
  const setsCount = parseInt(formData.get('sets') as string, 10);
  const setDetailsString = formData.get('set_details') as string;
  const altSetDetailsString = formData.get('alt_set_details') as string | null;
  const supersetSetDetailsString = formData.get('superset_set_details') as string | null;
  const notes = formData.get('notes') as string | null;
  if (!exerciseId || isNaN(setsCount) || setsCount <= 0 || !setDetailsString) return { success: false, error: 'Missing required fields (exercise, sets, details).' };
   if (alternativeExerciseId && !altSetDetailsString) return { success: false, error: 'Alternative set details are required when alternative exercise is selected.' };
    if (supersetExerciseId && !supersetSetDetailsString) return { success: false, error: 'Superset set details are required when superset exercise is selected.' };
  let setDetailsJson: any, altSetDetailsJson: any | null = null, supersetSetDetailsJson: any | null = null;
  try { setDetailsJson = JSON.parse(setDetailsString); if (!Array.isArray(setDetailsJson) || setDetailsJson.length !== setsCount) throw new Error('Primary set details count mismatch.'); if (alternativeExerciseId && altSetDetailsString) { altSetDetailsJson = JSON.parse(altSetDetailsString); if (!Array.isArray(altSetDetailsJson) || altSetDetailsJson.length !== setsCount) throw new Error('Alternative set details count mismatch.'); } if (supersetExerciseId && supersetSetDetailsString) { supersetSetDetailsJson = JSON.parse(supersetSetDetailsString); if (!Array.isArray(supersetSetDetailsJson) || supersetSetDetailsJson.length !== setsCount) throw new Error('Superset set details count mismatch.'); } } catch (e) { return { success: false, error: `Invalid set details format: ${e instanceof Error ? e.message : String(e)}` }; }
  const { error: updateError } = await supabase.from('workout_template_items').update({ exercise_id: exerciseId, alternative_exercise_id: alternativeExerciseId, superset_exercise_id: supersetExerciseId, sets: setsCount, set_details: setDetailsJson, alt_set_details: altSetDetailsJson, superset_set_details: supersetSetDetailsJson, notes: notes }).eq('id', itemId);
  if (updateError) return { success: false, error: `Failed to update workout item: ${updateError.message}` };
  try { revalidateTag(`template-items-${templateId}`); } catch (revalError) { return { success: true, message: 'Workout item updated, but revalidation might have failed.' }; }
  return { success: true, message: 'Workout item updated.' };
}

export async function deleteWorkoutItem(itemId: string, templateId: string): Promise<ActionResult> {
  if (!itemId || !templateId) return { success: false, error: 'Invalid request arguments.' };
  const supabase = createClient();
  const { data: { user: coachUser } } = await supabase.auth.getUser();
  if (!coachUser) return { success: false, error: 'Authentication required.' };
  const { data: coachProfile } = await supabase.from('profiles').select('role').eq('id', coachUser.id).single();
  if (!coachProfile || coachProfile.role !== 'coach') return { success: false, error: 'Unauthorized.' };
  const { count, error: checkError } = await supabase.from('workout_template_items').select(`id, workout_templates ( coach_id )`, { count: 'exact', head: true }).eq('id', itemId).eq('workout_templates.coach_id', coachUser.id);
  if (checkError || count === 0) return { success: false, error: 'Workout item not found or permission denied.' };
  const { error: deleteError } = await supabase.from('workout_template_items').delete().eq('id', itemId);
  if (deleteError) return { success: false, error: `Failed to delete workout item: ${deleteError.message}` };
  try { revalidateTag(`template-items-${templateId}`); } catch (revalError) { console.error("Error during revalidation after delete:", revalError); }
  return { success: true, message: 'Workout item deleted.' };
}

export async function duplicateWorkoutItem(itemId: string, templateId: string): Promise<ActionResult> {
  if (!itemId || !templateId) return { success: false, error: 'Invalid request arguments.' };
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Authentication required.' };
  const { data: templateOwner, error: ownerCheckError } = await supabase.from('workout_templates').select('coach_id').eq('id', templateId).single();
  if (ownerCheckError || !templateOwner || templateOwner.coach_id !== user.id) return { success: false, error: 'Template not found or permission denied.' };
  const { data: itemToDuplicate, error: fetchError } = await supabase.from('workout_template_items').select('*').eq('id', itemId).eq('template_id', templateId).single();
  if (fetchError || !itemToDuplicate) return { success: false, error: 'Workout item to duplicate not found.' };
  let nextOrder = 1;
  try { const { data: lastItem, error: orderError } = await supabase.from('workout_template_items').select('item_order').eq('template_id', templateId).order('item_order', { ascending: false }).limit(1).maybeSingle(); if (orderError) throw orderError; if (lastItem) nextOrder = (lastItem.item_order ?? 0) + 1; } catch (e) { return { success: false, error: 'Could not determine item order for duplicate.' }; }
  const { id, created_at, updated_at, item_order, ...duplicateData } = itemToDuplicate;
  const newItemData = { ...duplicateData, item_order: nextOrder };
  const { error: insertError } = await supabase.from('workout_template_items').insert(newItemData);
  if (insertError) return { success: false, error: `Failed to duplicate workout item: ${insertError.message}` };
  try { revalidateTag(`template-items-${templateId}`); } catch (revalError) { console.error("Error during revalidation after duplication:", revalError); }
  return { success: true, message: 'Workout item duplicated.' };
}

export async function moveWorkoutItem(templateId: string, itemId: string, direction: 'up' | 'down') {
  if (!templateId || !itemId || !direction) return { success: false, error: 'Invalid arguments.' };
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Authentication required.' };
  const { data: templateOwner, error: ownerCheckError } = await supabase.from('workout_templates').select('coach_id').eq('id', templateId).single();
  if (ownerCheckError || !templateOwner || templateOwner.coach_id !== user.id) return { success: false, error: 'Template not found or permission denied.' };
  const { data: currentItem, error: currentItemError } = await supabase.from('workout_template_items').select('id, item_order').eq('id', itemId).eq('template_id', templateId).single();
  if (currentItemError || !currentItem) return { success: false, error: 'Workout item not found.' };
  const currentOrder = currentItem.item_order;
  let adjacentItem: { id: string; item_order: number } | null = null;
  if (direction === 'up') { const { data, error } = await supabase.from('workout_template_items').select('id, item_order').eq('template_id', templateId).lt('item_order', currentOrder).order('item_order', { ascending: false }).limit(1).single(); if (error && error.code !== 'PGRST116') return { success: false, error: 'Could not find item to swap with.' }; adjacentItem = data; } else { const { data, error } = await supabase.from('workout_template_items').select('id, item_order').eq('template_id', templateId).gt('item_order', currentOrder).order('item_order', { ascending: true }).limit(1).single(); if (error && error.code !== 'PGRST116') return { success: false, error: 'Could not find item to swap with.' }; adjacentItem = data; }
  if (!adjacentItem) return { success: true, message: 'Item is already at the boundary.' };
  const { error: updateCurrentError } = await supabase.from('workout_template_items').update({ item_order: adjacentItem.item_order }).eq('id', currentItem.id);
  if (updateCurrentError) return { success: false, error: 'Failed to update item order (step 1).' };
  const { error: updateAdjacentError } = await supabase.from('workout_template_items').update({ item_order: currentOrder }).eq('id', adjacentItem.id);
  if (updateAdjacentError) return { success: false, error: 'Failed to update item order (step 2).' };
  try { revalidateTag(`template-items-${templateId}`); } catch (revalError) { console.error("Error during revalidation after move:", revalError); }
    return { success: true };
}

export async function deleteMultipleWorkoutItems(itemIds: string[], templateId: string) {
  if (!itemIds || itemIds.length === 0 || !templateId) return { success: false, error: 'Invalid arguments for deletion.' };
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Authentication required.' };
  const { data: templateOwner, error: ownerCheckError } = await supabase.from('workout_templates').select('coach_id').eq('id', templateId).single();
  if (ownerCheckError || !templateOwner || templateOwner.coach_id !== user.id) return { success: false, error: 'Template not found or permission denied.' };
  const { error: deleteError } = await supabase.from('workout_template_items').delete().in('id', itemIds).eq('template_id', templateId);
  if (deleteError) return { success: false, error: `Failed to delete some or all items. ${deleteError.message}` };
  try { revalidateTag(`template-items-${templateId}`); } catch (revalError) { console.error("Error during revalidation after multi-delete:", revalError); }
  return { success: true, message: `${itemIds.length} item(s) deleted.` };
}

export async function moveWorkoutGroup(templateId: string, exerciseType: string, direction: 'up' | 'down') {
    if (!templateId || !exerciseType || !direction) return { success: false, error: 'Invalid arguments.' };
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Authentication required.' };
    const { count: templateCount, error: ownerCheckError } = await supabase.from('workout_templates').select('*', { count: 'exact', head: true }).eq('id', templateId).eq('coach_id', user.id);
    if (ownerCheckError || !templateCount || templateCount === 0) return { success: false, error: 'Template not found or permission denied.' };
    const { data: allItems, error: fetchError } = await supabase.from('workout_template_items').select('id, item_order, exercise_id').eq('template_id', templateId).order('item_order', { ascending: true });
    if (fetchError || !allItems) return { success: false, error: 'Could not fetch workout items.' };
    if (allItems.length === 0) return { success: true, message: 'No items to move.' };
    const exerciseIds = allItems.map(item => item.exercise_id);
    let exerciseDetailsMap = new Map<string, { exercise_type: string }>();
     if (exerciseIds.length > 0) { const { data: exercises, error: exercisesError } = await supabase.from('exercises').select('id, exercise_type').in('id', exerciseIds); if (exercisesError) return { success: false, error: 'Could not fetch exercise details.' }; exercises?.forEach(ex => exerciseDetailsMap.set(ex.id, { exercise_type: ex.exercise_type || 'Other' })); }
    const itemsByType: Record<string, { id: string; item_order: number }[]> = {};
    allItems.forEach(item => { const type = exerciseDetailsMap.get(item.exercise_id)?.exercise_type || 'Other'; if (!itemsByType[type]) itemsByType[type] = []; itemsByType[type].push({ id: item.id, item_order: item.item_order }); });
    const sortedGroupKeys = Object.keys(itemsByType).sort((a, b) => { const firstItemOrderA = itemsByType[a][0]?.item_order ?? Infinity; const firstItemOrderB = itemsByType[b][0]?.item_order ?? Infinity; return firstItemOrderA - firstItemOrderB; });
    const currentGroupIndex = sortedGroupKeys.indexOf(exerciseType);
    if (currentGroupIndex === -1) return { success: false, error: `Group "${exerciseType}" not found.` };
    const targetGroupIndex = direction === 'up' ? currentGroupIndex - 1 : currentGroupIndex + 1;
    if (targetGroupIndex < 0 || targetGroupIndex >= sortedGroupKeys.length) return { success: true, message: 'Group is already at the boundary.' };
    const adjacentGroupType = sortedGroupKeys[targetGroupIndex];
    const groupToMoveItems = itemsByType[exerciseType];
    const adjacentGroupItems = itemsByType[adjacentGroupType];
    const combinedItems = direction === 'up' ? [...groupToMoveItems, ...adjacentGroupItems] : [...adjacentGroupItems, ...groupToMoveItems];
    const startOrder = direction === 'up' ? adjacentGroupItems[0]?.item_order : groupToMoveItems[0]?.item_order;
     if (startOrder === undefined) return { success: false, error: 'Calculation error during group move.' };
    const updates = combinedItems.map((item, index) => ({ id: item.id, item_order: startOrder + index }));
    let updateErrors: string[] = [];
    for (const update of updates) { const { error } = await supabase.from('workout_template_items').update({ item_order: update.item_order }).eq('id', update.id).eq('template_id', templateId); if (error) { updateErrors.push(`Failed to update item ID ${update.id}.`); return { success: false, error: `Failed to update item order during group move. ${updateErrors.join(' ')}` }; } }
     if (updateErrors.length > 0) return { success: false, error: `Failed to update order for some items during group move: ${updateErrors.join(' ')}` };
    try { revalidateTag(`template-items-${templateId}`); } catch (revalError) { console.error("Error during revalidation after group move:", revalError); }
    return { success: true };
}

export async function updateWorkoutTemplateItemOrder(templateId: string, orderedItemIds: string[]): Promise<ActionResult> {
    'use server';
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Authentication required.' };
    const { count: templateCount, error: ownerCheckError } = await supabase.from('workout_templates').select('*', { count: 'exact', head: true }).eq('id', templateId).eq('coach_id', user.id);
    if (ownerCheckError || !templateCount || templateCount === 0) return { success: false, error: 'Template not found or permission denied.' };
    const updates = orderedItemIds.map((id, index) => ({ id: id, item_order: index + 1 }));
    let updateErrors: string[] = [];
    for (const update of updates) { const { error } = await supabase.from('workout_template_items').update({ item_order: update.item_order }).eq('id', update.id).eq('template_id', templateId); if (error) { updateErrors.push(`Item ID ${update.id}`); } }
    if (updateErrors.length > 0) return { success: false, error: `Failed to update order for items: ${updateErrors.join(', ')}.` };
    try { revalidateTag(`template-items-${templateId}`); } catch (revalError) { return { success: true, message: 'Order saved, but revalidation might have failed.' }; }
    return { success: true, message: 'Workout order saved successfully.' };
}

// --- Client Action: bookSlot --- (Moved from client/actions.ts)
export async function bookSlot(formData: FormData) {
  const supabase = createClient();
  const slotId = formData.get('slotId') as string;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/login');
  const { data: clientProfile, error: profileError } = await supabase.from('profiles').select('role, coach_id').eq('id', user.id).single();
  if (profileError || !clientProfile || clientProfile.role !== 'client') return redirect('/dashboard?error=Unauthorized access.');
  if (!clientProfile.coach_id) return redirect('/client/booking?error=You are not assigned to a coach.');
  if (!slotId) return redirect('/client/booking?error=Invalid slot selected.');
  const now = new Date().toISOString();
  const { data: slotData, error: slotError } = await supabase.from('schedule_slots').select(`id, start_time, coach_id, max_attendees, bookings ( count )`).eq('id', slotId).eq('coach_id', clientProfile.coach_id).gte('start_time', now).single();
  if (slotError || !slotData) return redirect('/client/booking?error=Selected slot not found or unavailable.');
  const bookingCount = slotData.bookings[0]?.count ?? 0;
  if (bookingCount >= slotData.max_attendees) return redirect('/client/booking?error=Selected slot is fully booked.');
  const { count: existingBookingCount, error: existingBookingError } = await supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('slot_id', slotId).eq('client_id', user.id);
  if (existingBookingError) return redirect('/client/booking?error=Failed to verify existing bookings.');
  if (existingBookingCount && existingBookingCount > 0) return redirect('/client/booking?error=You are already booked for this slot.');
  const { error: insertError } = await supabase.from('bookings').insert({ slot_id: slotId, client_id: user.id, coach_id: slotData.coach_id, status: 'confirmed' });
  if (insertError) return redirect(`/client/booking?error=Failed to book slot. ${insertError.message}`);
  revalidatePath('/client/booking');
  redirect('/client/booking?message=Booking successful!');
}


// --- Add Manual Food Item ---
// Update return type to include the new food ID
export async function addManualFood(formData: FormData): Promise<ActionResult & { data?: { newFoodId: string } }> {
  const supabase = createClient();
  // 1. Get user and verify coach role
  const { data: { user } } = await supabase.auth.getUser();
  // Return error object if not authenticated
  if (!user) return { success: false, error: 'Authentication required.' };
  const { data: coachProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  // Return error object if not authorized
  if (!coachProfile || coachProfile.role !== 'coach') return { success: false, error: 'Unauthorized.' };

  // 2. Extract and validate form data
  const name = formData.get('name') as string;
  const brand_owner = formData.get('brand_owner') as string || null;
  const serving_size_qty_str = formData.get('serving_size_qty') as string;
  const serving_size_unit = formData.get('serving_size_unit') as string;

  // --- Extract ALL Nutrition Fields ---
  const calories_str = formData.get('calories') as string;
  const total_fat_g_str = formData.get('total_fat_g') as string | null;
  const saturated_fat_g_str = formData.get('saturated_fat_g') as string | null;
  const trans_fat_g_str = formData.get('trans_fat_g') as string | null;
  const cholesterol_mg_str = formData.get('cholesterol_mg') as string | null;
  const sodium_mg_str = formData.get('sodium_mg') as string | null;
  const total_carbohydrate_g_str = formData.get('total_carbohydrate_g') as string | null;
  const dietary_fiber_g_str = formData.get('dietary_fiber_g') as string | null;
  const total_sugars_g_str = formData.get('total_sugars_g') as string | null;
  const added_sugars_g_str = formData.get('added_sugars_g') as string | null;
  const protein_g_str = formData.get('protein_g') as string;
  const vitamin_d_mcg_str = formData.get('vitamin_d_mcg') as string | null;
  const calcium_mg_str = formData.get('calcium_mg') as string | null;
  const iron_mg_str = formData.get('iron_mg') as string | null;
  const potassium_mg_str = formData.get('potassium_mg') as string | null;
  const optional_nutrients_json = formData.get('optional_nutrients_json') as string | null;
  const source = 'manual'; // Hardcode source for this action

  // Basic required field validation (adjust as needed - maybe only name/serving is truly required?)
  if (!name || !serving_size_qty_str || !serving_size_unit || !calories_str || !protein_g_str || !total_carbohydrate_g_str || !total_fat_g_str) {
    return { success: false, error: 'Missing required fields (Name, Serving Size, Calories, Protein, Carbs, Fat).' };
  }

  // Convert numeric fields, handle errors
  // Helper function to parse float or return null, checking for non-negative
  const parseFloatOrNull = (value: string | null): number | null => {
    if (value === null || value.trim() === '') return null;
    const parsed = parseFloat(value);
    return isNaN(parsed) || parsed < 0 ? null : parsed;
  };

  // Convert numeric fields
  const serving_size_qty = parseFloatOrNull(serving_size_qty_str);
  const calories = parseFloatOrNull(calories_str);
  const total_fat_g = parseFloatOrNull(total_fat_g_str);
  const saturated_fat_g = parseFloatOrNull(saturated_fat_g_str);
  const trans_fat_g = parseFloatOrNull(trans_fat_g_str);
  const cholesterol_mg = parseFloatOrNull(cholesterol_mg_str);
  const sodium_mg = parseFloatOrNull(sodium_mg_str);
  const total_carbohydrate_g = parseFloatOrNull(total_carbohydrate_g_str);
  const dietary_fiber_g = parseFloatOrNull(dietary_fiber_g_str);
  const total_sugars_g = parseFloatOrNull(total_sugars_g_str);
  const added_sugars_g = parseFloatOrNull(added_sugars_g_str);
  const protein_g = parseFloatOrNull(protein_g_str);
  const vitamin_d_mcg = parseFloatOrNull(vitamin_d_mcg_str);
  const calcium_mg = parseFloatOrNull(calcium_mg_str);
  const iron_mg = parseFloatOrNull(iron_mg_str);
  const potassium_mg = parseFloatOrNull(potassium_mg_str);

  // Validate essential numeric conversions
  if (serving_size_qty === null || calories === null || protein_g === null || total_carbohydrate_g === null || total_fat_g === null) {
      return { success: false, error: 'Invalid numeric value for required fields (Serving Size, Calories, Protein, Carbs, Fat).' };
  }
   if (serving_size_qty <= 0) {
       return { success: false, error: 'Serving size must be positive.' };
   } // Corrected: Removed extra closing brace

   // Parse optional nutrients JSON
   let optionalNutrientsParsed: any[] = [];
   if (optional_nutrients_json) {
       try {
           optionalNutrientsParsed = JSON.parse(optional_nutrients_json);
           if (!Array.isArray(optionalNutrientsParsed)) {
               throw new Error("Optional nutrients data is not an array.");
           }
           // TODO: Add validation for each object in the array if needed
       } catch (e) {
           console.error("Error parsing optional nutrients JSON:", e);
           return { success: false, error: "Invalid format for optional nutrients data." };
       }
   }

   // Construct the full_nutrients JSON object
   const fullNutrientsData = {
       servingSize: serving_size_qty,
       servingSizeUnit: serving_size_unit.trim(),
       calories: calories,
       totalFat: total_fat_g,
       saturatedFat: saturated_fat_g,
       transFat: trans_fat_g,
       cholesterol: cholesterol_mg,
       sodium: sodium_mg,
       totalCarbohydrate: total_carbohydrate_g,
       dietaryFiber: dietary_fiber_g,
       totalSugars: total_sugars_g,
       addedSugars: added_sugars_g,
       protein: protein_g,
       vitaminD: vitamin_d_mcg,
       calcium: calcium_mg,
       iron: iron_mg,
       potassium: potassium_mg,
       optional: optionalNutrientsParsed // Add the parsed optional nutrients
   };


  // 3. Insert into foods table and select the new ID
  const { data: newFood, error: foodInsertError } = await supabase
    .from('foods')
    .insert({
      coach_id: user.id,
      name: name,
      brand_owner: brand_owner,
      serving_size_qty: serving_size_qty, // Use parsed value
      serving_size_unit: serving_size_unit.trim(),
      // Populate direct columns for compatibility/simplicity
      calories: calories,
      protein_g: protein_g,
      carbs_g: total_carbohydrate_g, // Use total carbs for the direct column
      fat_g: total_fat_g, // Use total fat for the direct column
      fiber_g: dietary_fiber_g, // Use dietary fiber
      sugar_g: total_sugars_g, // Use total sugars
      sodium_mg: sodium_mg,
      source: source,
      full_nutrients: fullNutrientsData as unknown as Json // Store comprehensive data
    })
    .select('id') // Select only the ID
    .single();


  if (foodInsertError || !newFood) { // Use the renamed error variable
    console.error('Error inserting food item:', foodInsertError);
    // Return error object instead of redirecting, handle potential null message
    return { success: false, error: `Failed to add food item: ${foodInsertError?.message ?? 'Unknown database error'}` };
  }

  // 4. Revalidate and return success with the new ID
  revalidatePath('/coach/nutrition/foods'); // Revalidate the list page
  // Return success object with ID instead of redirecting
  return { success: true, message: 'Food item added successfully!', data: { newFoodId: newFood.id } };
}


// --- Update Manual Food Item ---
export async function updateFood(foodId: string, formData: FormData): Promise<ActionResult> {
  if (!foodId) return { success: false, error: 'Food ID is required for update.' };

  const supabase = createClient();

  // 1. Get user and verify coach role
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Authentication required.' };
  const { data: coachProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!coachProfile || coachProfile.role !== 'coach') return { success: false, error: 'Unauthorized.' };

  // 2. Extract and validate form data
  const name = formData.get('name') as string;
  const brand_owner = formData.get('brand_owner') as string || null;
  const serving_size_qty_str = formData.get('serving_size_qty') as string;
  const serving_size_unit = formData.get('serving_size_unit') as string;
  const calories_str = formData.get('calories') as string;
  const protein_g_str = formData.get('protein_g') as string;
  const carbs_g_str = formData.get('carbs_g') as string;
  const fat_g_str = formData.get('fat_g') as string;
  const fiber_g_str = formData.get('fiber_g') as string || null;
  const sugar_g_str = formData.get('sugar_g') as string || null;
  const sodium_mg_str = formData.get('sodium_mg') as string || null;
  // Source is not updatable, assumed 'manual'

  // Basic required field validation
  if (!name || !serving_size_qty_str || !serving_size_unit || !calories_str || !protein_g_str || !carbs_g_str || !fat_g_str) {
    return { success: false, error: 'Missing required fields.' };
  }

  // Convert numeric fields, handle errors
  const serving_size_qty = parseFloat(serving_size_qty_str);
  const calories = parseFloat(calories_str);
  const protein_g = parseFloat(protein_g_str);
  const carbs_g = parseFloat(carbs_g_str);
  const fat_g = parseFloat(fat_g_str);
  const fiber_g = fiber_g_str ? parseFloat(fiber_g_str) : null;
  const sugar_g = sugar_g_str ? parseFloat(sugar_g_str) : null;
  const sodium_mg = sodium_mg_str ? parseFloat(sodium_mg_str) : null;

  if (isNaN(serving_size_qty) || isNaN(calories) || isNaN(protein_g) || isNaN(carbs_g) || isNaN(fat_g) || (fiber_g_str && isNaN(fiber_g!)) || (sugar_g_str && isNaN(sugar_g!)) || (sodium_mg_str && isNaN(sodium_mg!)) ) {
      return { success: false, error: 'Invalid numeric value entered.' };
  }
   if (serving_size_qty <= 0 || calories < 0 || protein_g < 0 || carbs_g < 0 || fat_g < 0 || (fiber_g != null && fiber_g < 0) || (sugar_g != null && sugar_g < 0) || (sodium_mg != null && sodium_mg < 0)) {
       return { success: false, error: 'Numeric values cannot be negative (except calories can be 0). Serving size must be positive.' };
   }

  // 3. Update the foods table
  const { error: updateError } = await supabase
    .from('foods')
    .update({
      name: name,
      brand_owner: brand_owner,
      serving_size_qty: serving_size_qty,
      serving_size_unit: serving_size_unit,
      calories: calories,
      protein_g: protein_g,
      carbs_g: carbs_g,
      fat_g: fat_g,
      fiber_g: fiber_g,
      sugar_g: sugar_g,
      sodium_mg: sodium_mg,
      // Do not update coach_id or source
    })
    .eq('id', foodId)
    .eq('coach_id', user.id); // Ensure coach owns the item

  if (updateError) {
    console.error('Error updating food item:', updateError);
    return { success: false, error: `Failed to update food item: ${updateError.message}` };
  }

  // 4. Revalidate and return success
  revalidatePath('/coach/nutrition/foods'); // Revalidate the list page
  return { success: true, message: 'Food item updated successfully!' };
}


// --- Delete Manual Food Item ---
export async function deleteFood(foodId: string): Promise<ActionResult> {
  if (!foodId) return { success: false, error: 'Food ID is required for deletion.' };

  const supabase = createClient();

  // 1. Get user and verify coach role
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Authentication required.' };
  const { data: coachProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!coachProfile || coachProfile.role !== 'coach') return { success: false, error: 'Unauthorized.' };

  // 2. Delete from foods table
  const { error: deleteError } = await supabase
    .from('foods')
    .delete()
    .eq('id', foodId)
    .eq('coach_id', user.id); // Ensure coach owns the item

  if (deleteError) {
    console.error('Error deleting food item:', deleteError);
    // Check for foreign key constraint violation (e.g., if food is used in a meal plan)
    if (deleteError.code === '23503') { // Foreign key violation code
        return { success: false, error: 'Cannot delete food item. It might be used in a meal or meal plan.' };
    }
    return { success: false, error: `Failed to delete food item: ${deleteError.message}` };
  }

  // 3. Revalidate and return success
  revalidatePath('/coach/nutrition/foods'); // Revalidate the list page
  return { success: true, message: 'Food item deleted successfully!' };
}


// --- Search USDA FoodData Central ---
interface UsdaFoodSearchResult {
  fdcId: number;
  description: string;
  brandOwner?: string;
  dataType?: string;
  foodNutrients?: { nutrientName: string; value: number; unitName: string }[]; // Include some basic nutrients for preview
}

export async function searchUsdaFoods(query: string): Promise<ActionResult & { foods?: UsdaFoodSearchResult[] }> {
  if (!query || query.trim().length < 3) {
    return { success: false, error: 'Please enter at least 3 characters to search.' };
  }

  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) {
    console.error('USDA_API_KEY is not set in environment variables.');
    return { success: false, error: 'USDA API key is not configured on the server.' };
  }

  const supabase = createClient(); // Needed for auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Authentication required.' };
  // Optional: Check coach role if needed, but searching might be okay for any logged-in user? Let's restrict to coaches for now.
  const { data: coachProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!coachProfile || coachProfile.role !== 'coach') return { success: false, error: 'Unauthorized.' };


  const searchUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}&query=${encodeURIComponent(query)}&dataType=Branded,Foundation,SR%20Legacy&pageSize=25`; // Search common types, limit results

  try {
    const response = await fetch(searchUrl);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})); // Try to parse error
      console.error('USDA API Error Response:', errorData);
      throw new Error(`USDA API request failed with status ${response.status}. ${errorData?.message || ''}`);
    }

    const data = await response.json();

    const foods: UsdaFoodSearchResult[] = data.foods?.map((food: any) => ({
      fdcId: food.fdcId,
      description: food.description,
      brandOwner: food.brandOwner || food.brandName, // Try different fields
      dataType: food.dataType,
      // Extract key nutrients if available (e.g., Calories, Protein, Carbs, Fat)
      foodNutrients: food.foodNutrients?.filter((n: any) =>
          ['Energy', 'Protein', 'Carbohydrate, by difference', 'Total lipid (fat)'].includes(n.nutrientName)
        ).map((n: any) => ({
          nutrientName: n.nutrientName,
          value: n.value,
          unitName: n.unitName?.toLowerCase() // Standardize unit names
        })) || [],
    })) || [];

    return { success: true, foods: foods };

  } catch (error) {
    console.error('Error searching USDA foods:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during the USDA search.';
    return { success: false, error: errorMessage };
  }
}


// --- Nutrition Program Meal Actions ---

// Add a Meal to a Program Day
export async function addNutritionProgramMeal(formData: FormData): Promise<ActionResult & { newMeal?: NewMealData | null }> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Authentication required.' };

    const programTemplateId = formData.get('programTemplateId') as string;
    const dayNumberStr = formData.get('dayNumber') as string;
    const mealName = formData.get('mealName') as string;

    if (!programTemplateId || !dayNumberStr || !mealName) {
        return { success: false, error: 'Missing required fields (program ID, day number, meal name).' };
    }

    const dayNumber = parseInt(dayNumberStr, 10);
    if (isNaN(dayNumber) || dayNumber <= 0) {
        return { success: false, error: 'Invalid day number.' };
    }

    // Verify ownership
    const ownsProgram = await verifyCoachOwnsProgram(supabase, programTemplateId, user.id);
    if (!ownsProgram) return { success: false, error: 'Permission denied or program not found.' };

    // Determine next meal_order for the day
    let nextOrder = 0;
    try {
        const { data: lastMeal, error: orderError } = await supabase
            .from('nutrition_program_meals')
            .select('meal_order')
            .eq('program_template_id', programTemplateId)
            .eq('day_number', dayNumber)
            .order('meal_order', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (orderError) throw orderError;
        if (lastMeal) {
            nextOrder = (lastMeal.meal_order ?? -1) + 1; // Handle potential null order
        }
    } catch (e) {
        console.error("Error determining meal order:", e);
        return { success: false, error: 'Could not determine meal order.' };
    }

    // Insert the new meal and select the inserted row
    const { data: insertedMeal, error: insertError } = await supabase
        .from('nutrition_program_meals')
        .insert({
            program_template_id: programTemplateId,
            day_number: dayNumber,
            meal_name: mealName,
            meal_order: nextOrder
        })
        .select() // Select the newly inserted row
        .single();

    if (insertError || !insertedMeal) {
        console.error('Error inserting nutrition program meal:', insertError);
        // Check for unique constraint violation (e.g., duplicate order)
         if (insertError?.code === '23505') { // Unique violation code
             return { success: false, error: `Failed to add meal. A meal with the same order might already exist for day ${dayNumber}. Please refresh.` };
         }
        return { success: false, error: `Failed to add meal: ${insertError?.message ?? 'Unknown database error'}` };
    }

    // Revalidate the edit page path (or use tags if more granular control is needed)
    revalidatePath(`/coach/nutrition/programs/${programTemplateId}/structure`); // Revalidate structure page
    // Add the new meal data to the success response
    return {
        success: true,
        message: `Meal "${mealName}" added to Day ${dayNumber}.`,
        newMeal: { ...insertedMeal, nutrition_program_meal_items: [] } // Ensure items array is present
    };
}

// Update a Meal (e.g., rename, reorder - simple example for rename)
export async function updateNutritionProgramMeal(mealId: string, formData: FormData): Promise<ActionResult> {
     const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Authentication required.' };

    const mealName = formData.get('mealName') as string;
    // TODO: Add logic for reordering if needed (would require programId, dayNumber, newOrder)

    if (!mealId || !mealName) {
        return { success: false, error: 'Missing required fields (meal ID, meal name).' };
    }

     // Verify ownership by joining through the template table
     const { data: mealData, error: fetchError } = await supabase
         .from('nutrition_program_meals')
         .select(`
             id,
             program_template_id,
             nutrition_program_templates ( coach_id )
         `)
         .eq('id', mealId)
         .single<MealWithTemplateCoach>(); // Apply the explicit type

     // Check for fetch errors first
     if (fetchError) {
        console.error("Update Meal Fetch Error:", { fetchError, mealId });
        return { success: false, error: 'Error fetching meal data.' };
     }
     // Check if mealData and the nested template/coach_id exist and match the user
     if (!mealData?.nutrition_program_templates?.coach_id || mealData.nutrition_program_templates.coach_id !== user.id) {
        console.error("Update Meal Verification Failed:", { mealData, userId: user.id });
        return { success: false, error: 'Meal not found or permission denied.' };
     }

    // Update the meal
    const { error: updateError } = await supabase
        .from('nutrition_program_meals')
        .update({ meal_name: mealName /*, meal_order: newOrder */ })
        .eq('id', mealId);

    if (updateError) {
        console.error('Error updating nutrition program meal:', updateError);
        return { success: false, error: `Failed to update meal: ${updateError.message}` };
    }

    revalidatePath(`/coach/nutrition/programs/${mealData.program_template_id}/edit`);
    return { success: true, message: `Meal updated successfully.` };
}


// Delete a Meal
export async function deleteNutritionProgramMeal(mealId: string): Promise<ActionResult> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Authentication required.' };

    if (!mealId) {
        return { success: false, error: 'Meal ID is required.' };
    }

     // Verify ownership and get programId for revalidation
     const { data: mealData, error: fetchError } = await supabase
         .from('nutrition_program_meals')
         .select(`
             id,
             program_template_id,
             nutrition_program_templates ( coach_id )
         `)
         .eq('id', mealId)
         .single<MealWithTemplateCoach>(); // Apply the explicit type

      // Check for fetch errors first
      if (fetchError) {
         console.error("Delete Meal Fetch Error:", { fetchError, mealId });
         return { success: false, error: 'Error fetching meal data.' };
      }
      // Check if mealData and the nested template/coach_id exist and match the user
      if (!mealData?.nutrition_program_templates?.coach_id || mealData.nutrition_program_templates.coach_id !== user.id) {
         console.error("Delete Meal Verification Failed:", { mealData, userId: user.id });
         return { success: false, error: 'Meal not found or permission denied.' };
     }

    // Delete the meal (meal items associated should cascade delete due to FK constraint)
    const { error: deleteError } = await supabase
        .from('nutrition_program_meals')
        .delete()
        .eq('id', mealId);

    if (deleteError) {
        console.error('Error deleting nutrition program meal:', deleteError);
         // Check for foreign key issues if cascade wasn't set up as expected (unlikely here)
        return { success: false, error: `Failed to delete meal: ${deleteError.message}` };
    }

    revalidatePath(`/coach/nutrition/programs/${mealData.program_template_id}/edit`);
    return { success: true, message: `Meal deleted successfully.` };
}


// --- Nutrition Program Meal Item Actions ---

// Add an Item to a Meal
export async function addNutritionProgramMealItem(formData: FormData): Promise<ActionResult> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Authentication required.' };

    const mealId = formData.get('mealId') as string;
    const foodId = formData.get('foodId') as string;
    const quantityStr = formData.get('quantity') as string;
    const unit = formData.get('unit') as string;

    if (!mealId || !foodId || !quantityStr || !unit) {
        return { success: false, error: 'Missing required fields (meal ID, food ID, quantity, unit).' };
    }

    const quantity = parseFloat(quantityStr);
    if (isNaN(quantity) || quantity <= 0) {
        return { success: false, error: 'Invalid quantity.' };
    }

    // Verify ownership of the meal
    const { owns: ownsMeal, programId } = await verifyCoachOwnsMeal(supabase, mealId, user.id);
    if (!ownsMeal || !programId) return { success: false, error: 'Permission denied or meal not found.' };

    // Verify the selected food exists and belongs to the coach (or is a general USDA one if we change logic later)
    // For now, assume food_id refers to an item in the coach's 'foods' table
    const { count: foodCount, error: foodCheckError } = await supabase
        .from('foods')
        .select('*', { count: 'exact', head: true })
        .eq('id', foodId)
        .eq('coach_id', user.id); // Ensure coach owns the food being added

    if (foodCheckError || !foodCount || foodCount === 0) {
         console.error("Food check failed:", { foodId, userId: user.id, foodCheckError });
        return { success: false, error: 'Selected food item not found in your library.' };
    }


    // Determine next item_order for the meal
    let nextOrder = 0;
    try {
        const { data: lastItem, error: orderError } = await supabase
            .from('nutrition_program_meal_items')
            .select('item_order')
            .eq('meal_id', mealId)
            .order('item_order', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (orderError) throw orderError;
        if (lastItem) {
            nextOrder = (lastItem.item_order ?? -1) + 1;
        }
    } catch (e) {
        console.error("Error determining meal item order:", e);
        return { success: false, error: 'Could not determine item order.' };
    }

    // Insert the new meal item
    const { error: insertError } = await supabase
        .from('nutrition_program_meal_items')
        .insert({
            meal_id: mealId,
            food_id: foodId,
            quantity: quantity,
            unit: unit,
            item_order: nextOrder
        });

    if (insertError) {
        console.error('Error inserting nutrition program meal item:', insertError);
        return { success: false, error: `Failed to add item: ${insertError.message}` };
    }

    revalidatePath(`/coach/nutrition/programs/${programId}/edit`);
    return { success: true, message: `Item added successfully.` };
}

// Update a Meal Item (quantity, unit, order)
export async function updateNutritionProgramMealItem(itemId: string, formData: FormData): Promise<ActionResult> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Authentication required.' };

    const quantityStr = formData.get('quantity') as string;
    const unit = formData.get('unit') as string;
    // TODO: Add logic for reordering if needed

    if (!itemId || !quantityStr || !unit) {
        return { success: false, error: 'Missing required fields (item ID, quantity, unit).' };
    }

     const quantity = parseFloat(quantityStr);
    if (isNaN(quantity) || quantity <= 0) {
        return { success: false, error: 'Invalid quantity.' };
    }

    // --- Ownership Verification ---
    // 1. Fetch the item to get meal_id
    const { data: item, error: itemError } = await supabase
        .from('nutrition_program_meal_items')
        .select('meal_id')
        .eq('id', itemId)
        .single();

    if (itemError || !item) {
        console.error("Update Item Fetch Error (Item):", { itemError, itemId });
        return { success: false, error: 'Item not found.' };
    }
    const mealId = item.meal_id;

    // 2. Fetch the meal to get program_template_id
    const { data: meal, error: mealError } = await supabase
        .from('nutrition_program_meals')
        .select('program_template_id')
        .eq('id', mealId)
        .single();

     if (mealError || !meal) {
        console.error("Update Item Fetch Error (Meal):", { mealError, mealId });
        return { success: false, error: 'Associated meal not found.' };
    }
    const programId = meal.program_template_id;

    // 3. Verify coach owns the program template
    const ownsProgram = await verifyCoachOwnsProgram(supabase, programId, user.id);
    if (!ownsProgram) {
        console.error("Update Item Verification Failed:", { programId, userId: user.id });
        return { success: false, error: 'Permission denied.' };
    }
    // --- End Ownership Verification ---


    // Update the item
    const { error: updateError } = await supabase
        .from('nutrition_program_meal_items')
        .update({ quantity: quantity, unit: unit /*, item_order: newOrder */ })
        .eq('id', itemId);

    if (updateError) {
        console.error('Error updating nutrition program meal item:', updateError);
        return { success: false, error: `Failed to update item: ${updateError.message}` };
    }

    revalidatePath(`/coach/nutrition/programs/${programId}/edit`);
    return { success: true, message: `Item updated successfully.` };
}

// Delete a Meal Item
export async function deleteNutritionProgramMealItem(itemId: string): Promise<ActionResult> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Authentication required.' };

    if (!itemId) {
        return { success: false, error: 'Item ID is required.' };
    }

    // --- Ownership Verification ---
     // 1. Fetch the item to get meal_id
    const { data: item, error: itemError } = await supabase
        .from('nutrition_program_meal_items')
        .select('meal_id')
        .eq('id', itemId)
        .single();

    if (itemError || !item) {
        console.error("Delete Item Fetch Error (Item):", { itemError, itemId });
        return { success: false, error: 'Item not found.' };
    }
    const mealId = item.meal_id;

    // 2. Fetch the meal to get program_template_id
    const { data: meal, error: mealError } = await supabase
        .from('nutrition_program_meals')
        .select('program_template_id')
        .eq('id', mealId)
        .single();

     if (mealError || !meal) {
        console.error("Delete Item Fetch Error (Meal):", { mealError, mealId });
        return { success: false, error: 'Associated meal not found.' };
    }
    const programId = meal.program_template_id;

    // 3. Verify coach owns the program template
    const ownsProgram = await verifyCoachOwnsProgram(supabase, programId, user.id);
    if (!ownsProgram) {
        console.error("Delete Item Verification Failed:", { programId, userId: user.id });
        return { success: false, error: 'Permission denied.' };
    }
    // --- End Ownership Verification ---


    // Delete the item
    const { error: deleteError } = await supabase
        .from('nutrition_program_meal_items')
        .delete()
        .eq('id', itemId);

    if (deleteError) {
        console.error('Error deleting nutrition program meal item:', deleteError);
        return { success: false, error: `Failed to delete item: ${deleteError.message}` };
    }

    revalidatePath(`/coach/nutrition/programs/${programId}/edit`);
    return { success: true, message: `Item deleted successfully.` };
}




// --- Add Nutrition Program Template ---
// Return type for this action
type AddNutritionProgramResult = ActionResult & { data?: { newTemplateId: string } };

export async function addNutritionProgramTemplate(formData: FormData): Promise<AddNutritionProgramResult> {
  const supabase = createClient();
  const { data: { user: coachUser } } = await supabase.auth.getUser();
  // Return error object if not authenticated
  if (!coachUser) return { success: false, error: 'Authentication required.' };

  // Verify coach role
  const { data: coachProfile } = await supabase.from('profiles').select('role').eq('id', coachUser.id).single();
  // Return error object if not authorized
  if (!coachProfile || coachProfile.role !== 'coach') return { success: false, error: 'Unauthorized.' };

  // Extract form data
  const name = formData.get('name') as string;
  const description = formData.get('description') as string || null;
  const category = formData.get('category') as string || null;

  // Extract new nutritional target fields
  const calorie_target_type = formData.get('calorie_target_type') as string | null;
  const min_calories_str = formData.get('min_calories') as string | null;
  const max_calories_str = formData.get('max_calories') as string | null;
  const min_protein_grams_str = formData.get('min_protein_grams') as string | null;
  const max_protein_grams_str = formData.get('max_protein_grams') as string | null;
  const min_carb_grams_str = formData.get('min_carb_grams') as string | null;
  const max_carb_grams_str = formData.get('max_carb_grams') as string | null;
  const min_fat_grams_str = formData.get('min_fat_grams') as string | null;
  const max_fat_grams_str = formData.get('max_fat_grams') as string | null;
  const min_sugar_grams_str = formData.get('min_sugar_grams') as string | null;
  const max_sugar_grams_str = formData.get('max_sugar_grams') as string | null;
  // Keep target_meals_per_day if it's still relevant/used elsewhere, otherwise remove
  const targetMealsStr = formData.get('target_meals_per_day') as string | null; // Assuming this field might still exist or be added later
  // Extract new duration and supplement fields
  const durationValueStr = formData.get('duration_value') as string | null;
  const durationUnit = formData.get('duration_unit') as string | null;
  const supplementsStr = formData.get('supplements') as string | null; // Assuming supplements are passed as a JSON string for now

  // Validate required fields
  if (!name) {
    // Return error object
    return { success: false, error: 'Program name is required.' };
  }

  // Helper function to parse float or return null, checking for non-negative
  const parseFloatOrNull = (value: string | null): number | null => {
    if (value === null || value.trim() === '') return null;
    const parsed = parseFloat(value);
    // Return null if parsing fails or if the value is negative
    return isNaN(parsed) || parsed < 0 ? null : parsed;
  };

  // Parse all numeric fields
  const min_calories = parseFloatOrNull(min_calories_str);
  const max_calories = parseFloatOrNull(max_calories_str);
  const min_protein_grams = parseFloatOrNull(min_protein_grams_str);
  const max_protein_grams = parseFloatOrNull(max_protein_grams_str);
  const min_carb_grams = parseFloatOrNull(min_carb_grams_str);
  const max_carb_grams = parseFloatOrNull(max_carb_grams_str);
  const min_fat_grams = parseFloatOrNull(min_fat_grams_str);
  const max_fat_grams = parseFloatOrNull(max_fat_grams_str);
  const min_sugar_grams = parseFloatOrNull(min_sugar_grams_str);
  const max_sugar_grams = parseFloatOrNull(max_sugar_grams_str);
  const targetMeals = parseFloatOrNull(targetMealsStr); // Keep parsing this if needed
  const durationValue = parseFloatOrNull(durationValueStr);

  // Validate that if a string value existed, the parsed value is not null (indicates parsing error)
  const numericFields = [
    [min_calories_str, min_calories], [max_calories_str, max_calories],
    [min_protein_grams_str, min_protein_grams], [max_protein_grams_str, max_protein_grams],
    [min_carb_grams_str, min_carb_grams], [max_carb_grams_str, max_carb_grams],
    [min_fat_grams_str, min_fat_grams], [max_fat_grams_str, max_fat_grams],
    [min_sugar_grams_str, min_sugar_grams], [max_sugar_grams_str, max_sugar_grams],
    [targetMealsStr, targetMeals], // Include if kept
    [durationValueStr, durationValue] // Add duration value
  ];

  for (const [strVal, numVal] of numericFields) {
    // Ensure strVal is a string before trimming
    if (typeof strVal === 'string' && strVal.trim() !== '' && numVal === null) {
      // Return error object
      return { success: false, error: 'Invalid non-negative numeric value entered for one or more targets.' };
    }
  }

  // Optional: Validate min <= max for pairs where both are provided
  const minMaxValidation = [
      [min_calories, max_calories, 'calories'],
      [min_protein_grams, max_protein_grams, 'protein'],
      [min_carb_grams, max_carb_grams, 'carbs'],
      [min_fat_grams, max_fat_grams, 'fat'],
      [min_sugar_grams, max_sugar_grams, 'sugar'],
  ];
  for (const [minVal, maxVal, name] of minMaxValidation) {
      if (minVal !== null && maxVal !== null && minVal > maxVal) {
          // Return error object
          return { success: false, error: `Min ${name} cannot be greater than max ${name}.` };
      }
  }

  // Validate calorie_target_type
  const validCalorieType = calorie_target_type === 'deficit' || calorie_target_type === 'fixed' ? calorie_target_type : null; // Use 'fixed'

  // Validate duration unit
  const validDurationUnit = durationUnit === 'days' || durationUnit === 'weeks' || durationUnit === 'months' ? durationUnit : null;
  if (durationValue !== null && validDurationUnit === null) {
      return { success: false, error: 'Invalid duration unit selected.' };
  }
  if (durationValue === null && validDurationUnit !== null) {
      return { success: false, error: 'Duration value is required when duration unit is selected.' };
  }

  // Parse supplements (assuming simple text area input for now: Name - Dosage - Notes)
  let supplementsJson: Supplement[] | null = null;
  if (supplementsStr && supplementsStr.trim() !== '') {
      try {
          supplementsJson = supplementsStr.split('\n').map((line, index) => {
              const parts = line.split('-').map(p => p.trim());
              if (parts.length < 2 || !parts[0] || !parts[1]) {
                  throw new Error(`Invalid format on line ${index + 1}: "${line}". Expected "Name - Dosage [- Notes]"`);
              }
              return {
                  id: crypto.randomUUID(), // Generate UUID for new supplement
                  name: parts[0],
                  dosage: parts[1],
                  notes: parts[2] || null
              };
          }).filter(s => s.name && s.dosage); // Filter out potentially empty lines
      } catch (e) {
          const errorMessage = e instanceof Error ? e.message : 'Invalid supplement format.';
          return { success: false, error: `Error parsing supplements: ${errorMessage}` };
      }
  }


  // Insert into the database
  const { data: newTemplate, error: insertError } = await supabase
    .from('nutrition_program_templates')
    .insert({
      coach_id: coachUser.id,
      name: name,
      description: description,
      category: category,
      // Add new fields
      calorie_target_type: validCalorieType,
      min_calories: min_calories,
      max_calories: max_calories,
      min_protein_grams: min_protein_grams,
      max_protein_grams: max_protein_grams,
      min_carb_grams: min_carb_grams,
      max_carb_grams: max_carb_grams,
      min_fat_grams: min_fat_grams,
      max_fat_grams: max_fat_grams,
      min_sugar_grams: min_sugar_grams,
      max_sugar_grams: max_sugar_grams,
      target_meals_per_day: targetMeals, // Keep if needed
      // Add new duration and supplement fields
      duration_value: durationValue,
      duration_unit: validDurationUnit,
      supplements: supplementsJson
    })
    .select('id')
    .single();

  if (insertError || !newTemplate) {
    console.error('Error creating nutrition program template:', insertError);
    // Return error object
    return { success: false, error: `Failed to create program template. ${insertError?.message}` };
  }

  // Revalidate the path for the programs list page
  revalidatePath('/coach/nutrition/programs');

  // Return success object with the new ID
  return {
      success: true,
      message: 'Program template created successfully!',
      data: { newTemplateId: newTemplate.id }
  };
}


// --- Update Nutrition Program Template Details ---

// Type for raw input, allowing strings for numbers that need parsing
type RawNutritionProgramTemplateUpdates = Partial<{
  [K in keyof NutritionProgramTemplateUpdates]: K extends // Check if key is numeric or potentially stringified number
    | 'min_calories' | 'max_calories' | 'min_protein_grams' | 'max_protein_grams'
    | 'min_carb_grams' | 'max_carb_grams' | 'min_fat_grams' | 'max_fat_grams'
    | 'min_sugar_grams' | 'max_sugar_grams' | 'target_meals_per_day' | 'duration_value'
    ? string | number | null // Allow string or number for these fields
    : NutritionProgramTemplateUpdates[K]; // Use original type for others (string | null, enum | null, Supplement[] | null)
}>;


export async function updateNutritionProgramTemplateDetails(
    programId: string,
    rawUpdates: RawNutritionProgramTemplateUpdates // Use the more specific raw input type
): Promise<ActionResult> {
    if (!programId || !rawUpdates || Object.keys(rawUpdates).length === 0) {
        return { success: false, error: 'Invalid arguments for update.' };
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Authentication required.' };

    // Verify ownership first and fetch current values for validation
    // Define type for the fetched data (non-null version)
    type TemplateOwnerBaseData = {
        coach_id: string;
        min_calories: number | null;
        max_calories: number | null;
        min_protein_grams: number | null;
        max_protein_grams: number | null;
        min_carb_grams: number | null;
        max_carb_grams: number | null;
        min_fat_grams: number | null;
        max_fat_grams: number | null;
        min_sugar_grams: number | null;
        max_sugar_grams: number | null;
    };
    // Type for the actual fetched data (can be null)
    type TemplateOwnerData = TemplateOwnerBaseData | null;

    const { data: templateOwner, error: ownerCheckError } = await supabase
        .from('nutrition_program_templates')
        .select(`
            coach_id,
            min_calories, max_calories,
            min_protein_grams, max_protein_grams,
            min_carb_grams, max_carb_grams,
            min_fat_grams, max_fat_grams,
            min_sugar_grams, max_sugar_grams
        `)
        .eq('id', programId)
        .single(); // Let Supabase/TS infer the type

    if (ownerCheckError || !templateOwner) {
        console.error("Update Details - Owner Check Error:", ownerCheckError);
        return { success: false, error: 'Program template not found.' };
    }
    if (templateOwner.coach_id !== user.id) {
        return { success: false, error: 'Permission denied.' };
    }

    // --- Process, Type Convert, and Validate Updates ---
    const processedUpdates: any = {}; // Start with any type to avoid TS inference issues in loop
    const numericKeys: (keyof NutritionProgramTemplateUpdates)[] = [ // Keep this list to identify numeric keys
        'min_calories', 'max_calories', 'min_protein_grams', 'max_protein_grams',
        'min_carb_grams', 'max_carb_grams', 'min_fat_grams', 'max_fat_grams',
        'min_sugar_grams', 'max_sugar_grams', 'target_meals_per_day', 'duration_value'
    ];

    // Iterate over the keys present in the rawUpdates object
    for (const key of Object.keys(rawUpdates) as Array<keyof RawNutritionProgramTemplateUpdates>) {
        // Check if the key is actually a property of rawUpdates (safer loop)
        if (!Object.prototype.hasOwnProperty.call(rawUpdates, key)) {
            continue;
        }

        const K = key as keyof NutritionProgramTemplateUpdates; // Use the target type key for indexing processedUpdates
        const value = rawUpdates[K]; // Get the raw value (type depends on K in RawNutritionProgramTemplateUpdates)

        if (numericKeys.includes(K)) {
            let numValue: number | null = null;
            if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
                numValue = null;
            } else if (typeof value === 'number') {
                if (value >= 0) {
                    numValue = value;
                } else {
                     return { success: false, error: `Invalid negative numeric value provided for ${key}.` };
                }
            } else if (typeof value === 'string') {
                const parsed = parseFloat(value);
                if (!isNaN(parsed) && parsed >= 0) {
                    numValue = parsed;
                } else {
                    if (value.trim() !== '') { // Error only if non-empty string failed parsing
                        return { success: false, error: `Invalid non-negative numeric string provided for ${key}.` };
                    } else { // Treat empty string as null
                        numValue = null;
                    }
                }
            } else {
                 // This case should ideally not be hit if RawNutritionProgramTemplateUpdates is correct
                 return { success: false, error: `Unexpected type for numeric field ${key}: ${typeof value}` };
            }
            processedUpdates[K] = numValue as any; // Use 'as any' to bypass persistent type error here
        } else if (K === 'description' || K === 'category' || K === 'name') {
             processedUpdates[K] = (value === '' || value === null || value === undefined) ? null : String(value);
        } else if (K === 'calorie_target_type') {
             processedUpdates[K] = value === 'fixed' || value === 'deficit' ? value as 'fixed' | 'deficit' : null;
        } else if (K === 'duration_unit') {
             processedUpdates[K] = value === 'days' || value === 'weeks' || value === 'months' ? value as 'days' | 'weeks' | 'months' : null;
        } else if (K === 'supplements') {
             if (Array.isArray(value) || value === null) {
                 // TODO: Add validation for Supplement structure if needed
                 processedUpdates[K] = value as Supplement[] | null;
             } else if (value !== undefined) { // Only warn/error if value exists but is wrong type
                 console.warn(`Invalid type for supplements update: ${typeof value}. Expected array or null.`);
                 // Optionally return error: return { success: false, error: `Invalid type for supplements.` };
             }
             // If value is undefined, the key won't be in Object.keys(rawUpdates), so do nothing
        }
        // Add other non-numeric fields if necessary
    }

     // --- Min/Max Validation using processedUpdates and original data ---
     const checkMinMax = (minKey: keyof NutritionProgramTemplateUpdates, maxKey: keyof NutritionProgramTemplateUpdates, name: string) => {
         // Get original values safely, checking if templateOwner exists
         // Use direct property access if possible, otherwise fallback to dynamic keys with casting
         const originalMin = templateOwner ? (templateOwner[minKey as keyof TemplateOwnerBaseData] ?? null) : null;
         const originalMax = templateOwner ? (templateOwner[maxKey as keyof TemplateOwnerBaseData] ?? null) : null;

         // Determine final values, letting TS infer the type (number | null)
         let minVal = originalMin;
         if (processedUpdates[minKey] !== undefined) {
             minVal = processedUpdates[minKey] as number | null;
         }
         let maxVal: number | null = originalMax;
         if (processedUpdates[maxKey] !== undefined) {
             maxVal = processedUpdates[maxKey] as number | null;
         }

         // Explicitly check if both are numbers before comparing
         if (typeof minVal === 'number' && typeof maxVal === 'number') {
            if (minVal > maxVal) {
                 return { success: false, error: `Min ${name} cannot be greater than max ${name}.` };
            }
         }
         return { success: true };
     };

     let validationResult = checkMinMax('min_calories', 'max_calories', 'calories');
     if (!validationResult.success) return validationResult;
     validationResult = checkMinMax('min_protein_grams', 'max_protein_grams', 'protein');
     if (!validationResult.success) return validationResult;
     validationResult = checkMinMax('min_carb_grams', 'max_carb_grams', 'carbs');
     if (!validationResult.success) return validationResult;
     validationResult = checkMinMax('min_fat_grams', 'max_fat_grams', 'fat');
     if (!validationResult.success) return validationResult;
     validationResult = checkMinMax('min_sugar_grams', 'max_sugar_grams', 'sugar');
     if (!validationResult.success) return validationResult;
    // --- End Validation ---

    if (Object.keys(processedUpdates).length === 0) {
        return { success: true, message: 'No valid changes detected.' };
    }

    // Perform the update with correctly typed data
    const { error: updateError } = await supabase
        .from('nutrition_program_templates')
        .update(processedUpdates as NutritionProgramTemplateUpdates) // Ensure correct type is passed to Supabase
        .eq('id', programId);

    if (updateError) {
        console.error('Error updating nutrition program template details:', updateError);
        return { success: false, error: `Failed to update program details: ${updateError.message}` };
    }

    // Revalidate relevant paths/tags
    revalidatePath('/coach/nutrition/programs'); // List page
    revalidatePath(`/coach/nutrition/programs/${programId}/edit`); // Edit page

    return { success: true, message: 'Program details updated successfully.' };
  }
// --- Delete Nutrition Program Template ---
export async function deleteNutritionProgramTemplate(programId: string): Promise<ActionResult> {
  if (!programId) return { success: false, error: 'Program ID is required.' };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Authentication required.' };

  // Verify ownership
  const { count, error: checkError } = await supabase
    .from('nutrition_program_templates')
    .select('*', { count: 'exact', head: true })
    .eq('id', programId)
    .eq('coach_id', user.id);

  if (checkError || !count || count === 0) {
    return { success: false, error: 'Program template not found or permission denied.' };
  }

  // Attempt to delete the template
  // Note: Ensure cascade delete is set up in Supabase for related meals/items,
  // or handle their deletion manually here if needed.
  const { error: deleteError } = await supabase
    .from('nutrition_program_templates')
    .delete()
    .eq('id', programId);

  if (deleteError) {
    console.error('Error deleting nutrition program template:', deleteError);
    // Check for specific errors, e.g., foreign key constraints if not cascaded
    if (deleteError.code === '23503') { // Foreign key violation
        return { success: false, error: 'Cannot delete program. It might be assigned to a client or have related data that prevents deletion.' };
    }
    return { success: false, error: `Failed to delete program template: ${deleteError.message}` };
  }

  // Revalidate the programs list page
  revalidatePath('/coach/nutrition/programs');

  return { success: true, message: 'Program template deleted successfully.' };
}


// --- Meal Template Management ---
export async function addMealTemplate(formData: FormData) {
  const supabase = createClient();
  const { data: { user: coachUser } } = await supabase.auth.getUser();
  if (!coachUser) return redirect('/login');

  // Verify coach role
  const { data: coachProfile } = await supabase.from('profiles').select('role').eq('id', coachUser.id).single();
  if (!coachProfile || coachProfile.role !== 'coach') return redirect('/dashboard?error=Unauthorized');

  // Extract form data
  const name = formData.get('name') as string;
  const description = formData.get('description') as string || null;

  // Validate required fields
  if (!name || name.trim() === '') {
    return redirect('/coach/nutrition/meals/add?error=Meal template name is required.');
  }

  // Insert into the database
  const { data: newMeal, error: insertError } = await supabase
    .from('meals')
    .insert({
      coach_id: coachUser.id,
      name: name.trim(),
      description: description ? description.trim() : null,
    })
    .select('id')
    .single();

  if (insertError || !newMeal) {
    console.error('Error creating meal template:', insertError);
    // Handle potential unique constraint violation (coach_id, name)
    if (insertError?.code === '23505') {
        return redirect(`/coach/nutrition/meals/add?error=A meal template with this name already exists.`);
    }
    return redirect(`/coach/nutrition/meals/add?error=Failed to create meal template. ${insertError?.message}`);
  }

  // Revalidate the path for the meals list page
  revalidatePath('/coach/nutrition/meals');

  // Redirect to the edit page for the newly created meal
  // We'll need to create this page: /coach/nutrition/meals/[mealId]/edit
  redirect(`/coach/nutrition/meals/${newMeal.id}/edit?message=Meal template created. Now add foods.`);
}

// Add an item (food) to a specific meal template
export async function addMealItemToTemplate(formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const { data: { user: coachUser } } = await supabase.auth.getUser();
  if (!coachUser) return { success: false, error: 'Authentication required.' };

  // Verify coach role
  const { data: coachProfile } = await supabase.from('profiles').select('role').eq('id', coachUser.id).single();
  if (!coachProfile || coachProfile.role !== 'coach') return { success: false, error: 'Unauthorized.' };

  // Extract form data
  const mealId = formData.get('mealId') as string;
  const foodId = formData.get('foodId') as string;
  const quantityStr = formData.get('quantity') as string;

  // Validate required fields
  if (!mealId || !foodId || !quantityStr) {
    return { success: false, error: 'Missing required fields (meal, food, quantity).' };
  }

  // Validate quantity
  const quantity = parseFloat(quantityStr);
  if (isNaN(quantity) || quantity <= 0) {
    return { success: false, error: 'Invalid quantity. Must be a positive number.' };
  }

  // Verify coach owns the meal template
  const { count: mealCount, error: mealCheckError } = await supabase
    .from('meals')
    .select('*', { count: 'exact', head: true })
    .eq('id', mealId)
    .eq('coach_id', coachUser.id);

  if (mealCheckError || !mealCount || mealCount === 0) {
    return { success: false, error: 'Meal template not found or permission denied.' };
  }

  // Verify coach owns the food item
  const { count: foodCount, error: foodCheckError } = await supabase
    .from('foods')
    .select('*', { count: 'exact', head: true })
    .eq('id', foodId)
    .eq('coach_id', coachUser.id);

  if (foodCheckError || !foodCount || foodCount === 0) {
    return { success: false, error: 'Selected food item not found in your library.' };
  }

  // Determine next sort_order
  let nextOrder = 0;
  try {
    const { data: lastItem, error: orderError } = await supabase
      .from('meal_items')
      .select('sort_order')
      .eq('meal_id', mealId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (orderError) throw orderError;
    if (lastItem && lastItem.sort_order !== null) { // Check if sort_order is not null
        nextOrder = lastItem.sort_order + 1;
    }
  } catch (e) {
    console.error("Error determining meal item sort order:", e);
    return { success: false, error: 'Could not determine item order.' };
  }

  // Insert the new meal item
  const { error: insertError } = await supabase
    .from('meal_items')
    .insert({
      meal_id: mealId,
      food_id: foodId,
      quantity: quantity,
      sort_order: nextOrder
    });

  if (insertError) {
    console.error('Error inserting meal item:', insertError);
    return { success: false, error: `Failed to add item to meal: ${insertError.message}` };
  }

  // Revalidate the edit page for this specific meal
  revalidatePath(`/coach/nutrition/meals/${mealId}/edit`);

  return { success: true, message: 'Food item added to meal successfully!' };
}

// Delete an item from a meal template
export async function deleteMealItemFromTemplate(itemId: string, mealId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { data: { user: coachUser } } = await supabase.auth.getUser();
  if (!coachUser) return { success: false, error: 'Authentication required.' };

  // Verify coach role
  const { data: coachProfile } = await supabase.from('profiles').select('role').eq('id', coachUser.id).single();
  if (!coachProfile || coachProfile.role !== 'coach') return { success: false, error: 'Unauthorized.' };

  // Validate IDs
  if (!itemId || !mealId) {
    return { success: false, error: 'Missing required IDs (item ID, meal ID).' };
  }

  // Verify coach owns the meal template by checking the meal_item's meal's coach_id
  const { data: itemData, error: itemCheckError } = await supabase
    .from('meal_items')
    .select(`
      id,
      meals ( coach_id )
    `)
    .eq('id', itemId)
    .eq('meal_id', mealId) // Ensure item belongs to the specified meal
    .single();

  if (itemCheckError || !itemData) {
    console.error("Delete Meal Item - Item Check Error:", itemCheckError);
    console.error("Delete Meal Item - Item Check Error:", itemCheckError);
    return { success: false, error: 'Meal item not found.' };
  }
  // Safely check the nested meals object/array and its coach_id
  let mealCoachId: string | null = null;
  if (itemData.meals) {
      // Check if it's an array (Supabase sometimes returns relations as arrays)
      if (Array.isArray(itemData.meals) && itemData.meals.length > 0) {
          mealCoachId = itemData.meals[0]?.coach_id ?? null;
      }
      // Check if it's an object (expected behavior for single relation)
      else if (typeof itemData.meals === 'object' && !Array.isArray(itemData.meals)) {
          mealCoachId = (itemData.meals as { coach_id: string }).coach_id;
      }
  }

  if (!mealCoachId || mealCoachId !== coachUser.id) {
    console.error("Delete Meal Item - Permission Denied:", { itemData, coachUserId: coachUser.id });
    return { success: false, error: 'Permission denied to delete this meal item.' };
  }

  // Delete the meal item
  const { error: deleteError } = await supabase
    .from('meal_items')
    .delete()
    .eq('id', itemId);

  if (deleteError) {
    console.error('Error deleting meal item:', deleteError);
    return { success: false, error: `Failed to delete item from meal: ${deleteError.message}` };
  }

  // Revalidate the edit page for this specific meal
  revalidatePath(`/coach/nutrition/meals/${mealId}/edit`);

  return { success: true, message: 'Item removed from meal successfully!' };
}

// Delete a meal template (and its items via cascade)
export async function deleteMealTemplate(mealId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { data: { user: coachUser } } = await supabase.auth.getUser();
  if (!coachUser) return { success: false, error: 'Authentication required.' };

  // Verify coach role
  const { data: coachProfile } = await supabase.from('profiles').select('role').eq('id', coachUser.id).single();
  if (!coachProfile || coachProfile.role !== 'coach') return { success: false, error: 'Unauthorized.' };

  // Validate ID
  if (!mealId) {
    return { success: false, error: 'Missing meal template ID.' };
  }

  // Verify coach owns the meal template
  const { count, error: checkError } = await supabase
    .from('meals')
    .select('*', { count: 'exact', head: true })
    .eq('id', mealId)
    .eq('coach_id', coachUser.id);

  if (checkError || !count || count === 0) {
    return { success: false, error: 'Meal template not found or permission denied.' };
  }

  // Delete the meal template (items should cascade delete)
  const { error: deleteError } = await supabase
    .from('meals')
    .delete()
    .eq('id', mealId);

  if (deleteError) {
    console.error('Error deleting meal template:', deleteError);
    // Check for foreign key constraints if cascade isn't working or if meals are referenced elsewhere
    if (deleteError.code === '23503') {
        return { success: false, error: 'Cannot delete meal template. It might be referenced elsewhere (e.g., in assigned plans - though not implemented yet).' };
    }
    return { success: false, error: `Failed to delete meal template: ${deleteError.message}` };
  }

  // Revalidate the meals list page
  revalidatePath('/coach/nutrition/meals');

  return { success: true, message: 'Meal template deleted successfully!' };
}

// Add all items from a saved meal template to a nutrition program meal
export async function addMealTemplateItemsToProgram(mealTemplateId: string, programMealId: string): Promise<ActionResult> {
    const supabase = createClient();
    const { data: { user: coachUser } } = await supabase.auth.getUser();
    if (!coachUser) return { success: false, error: 'Authentication required.' };

    // Verify coach role
    const { data: coachProfile } = await supabase.from('profiles').select('role').eq('id', coachUser.id).single();
    if (!coachProfile || coachProfile.role !== 'coach') return { success: false, error: 'Unauthorized.' };

    // Validate IDs
    if (!mealTemplateId || !programMealId) {
        return { success: false, error: 'Missing required IDs (meal template ID, program meal ID).' };
    }

    // Verify coach owns the source meal template
    const { count: templateCount, error: templateCheckError } = await supabase
        .from('meals')
        .select('*', { count: 'exact', head: true })
        .eq('id', mealTemplateId)
        .eq('coach_id', coachUser.id);

    if (templateCheckError || !templateCount || templateCount === 0) {
        return { success: false, error: 'Source meal template not found or permission denied.' };
    }

    // Verify coach owns the target nutrition program meal (and get program ID for revalidation)
    const { owns: ownsProgramMeal, programId } = await verifyCoachOwnsMeal(supabase, programMealId, coachUser.id);
    if (!ownsProgramMeal || !programId) {
        return { success: false, error: 'Target program meal not found or permission denied.' };
    }

    // Fetch items from the source meal template
    const { data: templateItems, error: fetchItemsError } = await supabase
        .from('meal_items')
        .select('food_id, quantity, sort_order') // Select necessary fields
        .eq('meal_id', mealTemplateId)
        .order('sort_order', { ascending: true });

    if (fetchItemsError) {
        console.error("Error fetching meal template items:", fetchItemsError);
        return { success: false, error: 'Could not fetch items from the meal template.' };
    }

    if (!templateItems || templateItems.length === 0) {
        return { success: false, error: 'Selected meal template has no items to add.' };
    }

    // Determine the starting sort order for the new items in the target meal
    let nextSortOrder = 0;
    try {
        const { data: lastProgramItem, error: orderError } = await supabase
            .from('nutrition_program_meal_items')
            .select('item_order')
            .eq('meal_id', programMealId)
            .order('item_order', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (orderError) throw orderError;
        if (lastProgramItem && lastProgramItem.item_order !== null) {
            nextSortOrder = lastProgramItem.item_order + 1;
        }
    } catch (e) {
        console.error("Error determining program meal item sort order:", e);
        return { success: false, error: 'Could not determine starting item order for target meal.' };
    }

    // Prepare the new items for insertion
    const itemsToInsert = templateItems.map((item, index) => ({
        meal_id: programMealId,
        food_id: item.food_id,
        quantity: item.quantity,
        unit: 'serving', // Default unit - maybe fetch from food? For now, use 'serving'
        item_order: nextSortOrder + index, // Assign sequential order
    }));

    // Insert the new items
    const { error: insertError } = await supabase
        .from('nutrition_program_meal_items')
        .insert(itemsToInsert);

    if (insertError) {
        console.error('Error inserting meal template items into program meal:', insertError);
        return { success: false, error: `Failed to add items from template: ${insertError.message}` };
    }

    // Revalidate the structure page path
    revalidatePath(`/coach/nutrition/programs/${programId}/structure`);

  return { success: true, message: `Items from meal template added successfully!` };
}

// --- Nutrition Program Assignment ---
export async function assignNutritionProgram(formData: FormData) {
  const supabase = createClient();
  const { data: { user: coachUser } } = await supabase.auth.getUser();
  if (!coachUser) return redirect('/login');

  // Verify coach role
  const { data: coachProfile } = await supabase.from('profiles').select('role').eq('id', coachUser.id).single();
  if (!coachProfile || coachProfile.role !== 'coach') return redirect('/dashboard?error=Unauthorized');

  // Extract form data
  const clientId = formData.get('clientId') as string;
  const programTemplateId = formData.get('programTemplateId') as string;
  const startDate = formData.get('startDate') as string;

  // Validate required fields
  if (!clientId || !programTemplateId || !startDate) {
    return redirect('/coach/assign-nutrition-program?error=Client, program template, and start date are required.');
  }

  // Validate client belongs to the coach
  const { count: clientCount, error: clientCheckError } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('id', clientId)
    .eq('coach_id', coachUser.id);

  if (clientCheckError || !clientCount || clientCount === 0) {
    return redirect('/coach/assign-nutrition-program?error=Selected client not found or does not belong to you.');
  }

  // Validate template belongs to the coach
  const { count: templateCount, error: templateCheckError } = await supabase
    .from('nutrition_program_templates')
    .select('*', { count: 'exact', head: true })
    .eq('id', programTemplateId)
    .eq('coach_id', coachUser.id);

  if (templateCheckError || !templateCount || templateCount === 0) {
    return redirect('/coach/assign-nutrition-program?error=Selected program template not found or does not belong to you.');
  }

  // Insert the assignment record
  // Note: The unique constraint `assigned_nutrition_programs_client_active_unique`
  // will automatically prevent inserting if an 'active' program already exists for the client.
  const { error: insertError } = await supabase
    .from('assigned_nutrition_programs')
    .insert({
      coach_id: coachUser.id,
      client_id: clientId,
      program_template_id: programTemplateId,
      start_date: startDate,
      status: 'active' // Default status
      // end_date could be calculated based on template duration if needed
    });

  if (insertError) {
    console.error('Error assigning nutrition program:', insertError);
    if (insertError.code === '23505') { // Unique constraint violation
        return redirect(`/coach/assign-nutrition-program?error=Client already has an active nutrition program assigned.`);
    }
    return redirect(`/coach/assign-nutrition-program?error=Failed to assign program: ${insertError.message}`);
  }

  // Revalidate paths (optional, depends on where assignments are displayed)
  // revalidatePath('/coach/clients'); // Example if assignments shown on client list
  // revalidatePath(`/client/${clientId}/nutrition`); // Example if client has a nutrition page

  // Redirect back to dashboard or a success page
  redirect('/dashboard?message=Nutrition program assigned successfully!');
}


// --- Import Selected USDA Food ---

export async function importUsdaFood(fdcId: number): Promise<ActionResult> {
  if (!fdcId) {
    return { success: false, error: 'Invalid Food ID provided for import.' };
  }

  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) {
    console.error('USDA_API_KEY is not set in environment variables.');
    return { success: false, error: 'USDA API key is not configured on the server.' };
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Authentication required.' };
  const { data: coachProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!coachProfile || coachProfile.role !== 'coach') return { success: false, error: 'Unauthorized.' };

  const detailsUrl = `https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${apiKey}&format=full`; // Use 'full' format for more nutrients

  try {
    const response = await fetch(detailsUrl);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('USDA API Details Error Response:', errorData);
      throw new Error(`USDA API details request failed for FDC ID ${fdcId} with status ${response.status}. ${errorData?.message || ''}`);
    }

    const foodDetails = await response.json();
    const nutrients = foodDetails.foodNutrients || [];

    // Map USDA data to our schema
    // Nutrient IDs: Energy (kcal)=1008, Protein=1003, Carb=1005, Fat=1004, Fiber=1079, Sugars=2000, Sodium=1093
    const foodToInsert: FoodInsertData = { // Use the explicit type here
      coach_id: user.id,
      fdc_id: foodDetails.fdcId, // Store the original FDC ID
      name: foodDetails.description,
      brand_owner: foodDetails.brandOwner || foodDetails.brandName || null,
      serving_size_qty: foodDetails.servingSize || 100, // Default to 100 if not available
      serving_size_unit: foodDetails.servingSizeUnit || 'g', // Default to 'g'
      calories: findNutrient(nutrients, 1008) ?? 0, // Energy (kcal)
      protein_g: findNutrient(nutrients, 1003) ?? 0, // Protein
      carbs_g: findNutrient(nutrients, 1005) ?? 0, // Carbohydrate, by difference
      fat_g: findNutrient(nutrients, 1004) ?? 0, // Total lipid (fat)
      fiber_g: findNutrient(nutrients, 1079), // Fiber, total dietary
      sugar_g: findNutrient(nutrients, 2000), // Sugars, total including NLEA
      sodium_mg: null, // Initialize sodium_mg, will be set below
      source: 'usda',
      full_nutrients: nutrients, // Store the full nutrients array
      // ingredients: foodDetails.ingredients, // Optional: store ingredients if needed later
    };

     // Check sodium unit (nutrient ID 1093) and set sodium_mg correctly
     const sodiumNutrient = nutrients.find((n: UsdaNutrient) => n.nutrient.id === 1093);
     if (sodiumNutrient?.amount !== undefined && sodiumNutrient?.amount !== null) {
         if (sodiumNutrient.nutrient.unitName?.toLowerCase() === 'g') {
             foodToInsert.sodium_mg = sodiumNutrient.amount * 1000; // Convert g to mg
         } else {
             // Assume mg or other direct value if not 'g'
             foodToInsert.sodium_mg = sodiumNutrient.amount;
         }
     } else {
         foodToInsert.sodium_mg = null; // Set to null if not found or amount is null/undefined
     }


    // Check if this food (by fdc_id and coach_id) already exists
    const { count: existingCount, error: checkError } = await supabase
      .from('foods')
      .select('*', { count: 'exact', head: true })
      .eq('coach_id', user.id)
      .eq('fdc_id', foodDetails.fdcId);

    if (checkError) {
        console.error("Error checking for existing USDA food:", checkError);
        return { success: false, error: "Database error checking for existing food." };
    }

    if (existingCount && existingCount > 0) {
        return { success: false, error: `"${foodDetails.description}" (FDC ID: ${foodDetails.fdcId}) is already in your library.` };
    }


    // Insert into the database
    const { error: insertError } = await supabase.from('foods').insert(foodToInsert);

    if (insertError) {
      console.error('Error inserting imported USDA food:', insertError);
      return { success: false, error: `Failed to import food: ${insertError.message}` };
    }

    revalidatePath('/coach/nutrition/foods'); // Revalidate the list page
    return { success: true, message: `"${foodDetails.description}" imported successfully!` };

  } catch (error) {
    console.error(`Error importing USDA food (FDC ID: ${fdcId}):`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during the USDA search.';
    return { success: false, error: errorMessage };
  }
}
