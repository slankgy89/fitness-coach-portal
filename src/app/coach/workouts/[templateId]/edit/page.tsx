'use client'; // Need to make this a client component for state

import React, { useState, useEffect, use, useCallback, useTransition, ChangeEvent } from 'react'; // Import use, useCallback, useTransition, ChangeEvent
import { createClient } from '@/lib/supabase/client'; // Use client for client-side fetching
import { redirect, useRouter } from 'next/navigation'; // Import useRouter
import Link from 'next/link';
import AuthMessages from '@/app/(auth)/AuthMessages';
import AddWorkoutItemForm from './AddWorkoutItemForm';
import WorkoutItemList from './WorkoutItemList';
import { deleteMultipleWorkoutItems, updateWorkoutTemplateDetails } from '@/app/coach/actions'; // Import actions
import { Button } from '@/components/ui/button'; // Import Button
import { Textarea } from '@/components/ui/textarea'; // Import Textarea
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"; // Import Collapsible
import { ChevronsUpDown, PlusCircle, Trash2, RotateCcw, AlertTriangle, FilePenLine, Save } from 'lucide-react'; // Import icons

// Define types (Consider moving to a central types file like src/types/index.ts)
// Type for SetDetail (matching AddWorkoutItemForm)
type SetDetail = {
  set: number;
  reps: string;
  weight: string;
  time: string;
  rest: string;
  resistance?: string | null;
  speed?: string | null;
  incline?: string | null;
};

type ExerciseForForm = {
  id: string;
  name: string;
  body_part: string;
  machine_type: string;
  exercise_type: string;
};

// Corrected WorkoutItem type to match WorkoutItemList
type WorkoutItem = {
  id: string;
  template_id: string;
  exercise_id: string;
  alternative_exercise_id: string | null;
  superset_exercise_id?: string | null;
  item_order: number;
  sets: number | null;
  notes: string | null;
  // group_id: number | null; // Removed - Mismatch with WorkoutItemList
  // group_order: number | null; // Removed - Mismatch with WorkoutItemList
  set_details: any | null;
  alt_set_details?: any | null;
  superset_set_details?: any | null;
  updated_at: string;
};

type WorkoutTemplate = {
  id: string;
  name: string;
  description: string | null;
};

// Note: This page is now a Client Component to manage collapsible state and fetch data client-side.
export default function EditWorkoutTemplatePage({ params }: { params: Promise<{ templateId: string }> }) { // Params is a Promise
  // Unwrap params using React.use()
  const resolvedParams = use(params);
  const templateId = resolvedParams.templateId;
  const supabase = createClient(); // Use client-side Supabase client
  const router = useRouter(); // Use router for navigation

  // State for fetched data
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [exercisesForForm, setExercisesForForm] = useState<ExerciseForForm[]>([]);
  const [initialTemplateItems, setInitialTemplateItems] = useState<WorkoutItem[]>([]);
  const [exerciseDetailsMap, setExerciseDetailsMap] = useState<Map<string, { name: string; exercise_type: string }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddFormOpen, setIsAddFormOpen] = useState(false); // State for collapsible form

  // --- Recycle Bin State (Lifted Up) ---
  const [recycledItems, setRecycledItems] = useState<WorkoutItem[]>([]);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [recycleBinError, setRecycleBinError] = useState<string | null>(null);
  const [isPermanentlyDeleting, startPermanentDeleteTransition] = useTransition();
  const [showDoneConfirmation, setShowDoneConfirmation] = useState(false); // State for inline confirmation

  // --- State for Editable Description ---
  const [isEditingDescription, setIsEditingDescription] = useState(false); // State to toggle edit mode
  const [initialDescription, setInitialDescription] = useState<string>('');
  const [currentDescription, setCurrentDescription] = useState<string>('');
  const [descriptionChanged, setDescriptionChanged] = useState(false);
  const [isSavingDescription, startSaveDescriptionTransition] = useTransition();
  const [saveDescriptionError, setSaveDescriptionError] = useState<string | null>(null);
  const [saveDescriptionMessage, setSaveDescriptionMessage] = useState<string | null>(null);

  // --- Recycle Bin Handlers (Lifted Up) ---
  const handleRecycleItems = useCallback((itemsToRecycle: WorkoutItem[]) => {
    setRecycledItems(prev => [...prev, ...itemsToRecycle]);
    setInitialTemplateItems(prev => prev.filter(item => !itemsToRecycle.some(recycled => recycled.id === item.id)));
    console.log(`${itemsToRecycle.length} items moved to recycle bin state in page.`);
  }, []);

  const handleRestoreItem = useCallback((itemId: string) => {
    setRecycleBinError(null);
    const itemToRestore = recycledItems.find(item => item.id === itemId);
    if (!itemToRestore) return;
    const remainingRecycled = recycledItems.filter(item => item.id !== itemId);
    setInitialTemplateItems(prev => [...prev, itemToRestore].sort((a, b) => a.item_order - b.item_order));
    setRecycledItems(remainingRecycled);
    console.log(`Item ${itemId} restored (state updated in page).`);
  }, [recycledItems]);

  const handleEmptyRecycleBin = useCallback(async (): Promise<boolean> => {
      if (recycledItems.length === 0) return true;
      setRecycleBinError(null);
      const idsToDelete = recycledItems.map(item => item.id);
      let success = false;
      await new Promise<void>(resolve => {
          startPermanentDeleteTransition(async () => {
              const result = await deleteMultipleWorkoutItems(idsToDelete, templateId);
              if (!result.success) {
                  console.error("Failed to permanently delete items:", result.error);
                  setRecycleBinError(result.error || 'Failed to empty recycle bin.');
                  success = false;
              } else {
                  console.log("Recycle bin emptied successfully.");
                  setRecycledItems([]);
                  success = true;
              }
              resolve();
          });
      });
      return success;
  }, [recycledItems, templateId, startPermanentDeleteTransition]);
  // --- End Recycle Bin Handlers ---

  // --- Description Handlers ---
  const handleDescriptionChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = event.target.value;
      setCurrentDescription(newValue);
      setDescriptionChanged(newValue !== initialDescription);
      setSaveDescriptionError(null);
      setSaveDescriptionMessage(null);
  };

  const handleSaveDescription = useCallback(() => {
      setSaveDescriptionError(null);
      setSaveDescriptionMessage(null);
      startSaveDescriptionTransition(async () => {
          const result = await updateWorkoutTemplateDetails(templateId, { description: currentDescription });
          if (!result.success) {
              setSaveDescriptionError(result.error || "Failed to save description.");
          } else {
              setInitialDescription(currentDescription);
              setDescriptionChanged(false);
              setIsEditingDescription(false); // Exit edit mode on save
              setSaveDescriptionMessage(result.message || "Description saved.");
              setTimeout(() => setSaveDescriptionMessage(null), 3000);
          }
      });
  }, [currentDescription, templateId, initialDescription]);
  // --- End Description Handlers ---


  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { redirect('/login'); return; }

      const profilePromise = supabase.from('profiles').select('role').eq('id', user.id).single();
      const templatePromise = supabase.from('workout_templates').select(`id, name, description`).eq('id', templateId).eq('coach_id', user.id).single();
      const exercisesPromise = supabase.from('exercises').select('id, name, body_part, machine_type, exercise_type').eq('coach_id', user.id).order('name');
      const itemsPromise = supabase.from('workout_template_items').select('*').eq('template_id', templateId).order('item_order', { ascending: true });

      try {
        const [
          { data: coachProfile, error: profileError },
          { data: templateData, error: templateError },
          { data: exercisesData, error: exercisesError },
          { data: itemsData, error: itemsError }
        ] = await Promise.all([profilePromise, templatePromise, exercisesPromise, itemsPromise]);

        if (profileError || !coachProfile || coachProfile.role !== 'coach') { redirect('/dashboard'); return; }
        if (templateError) throw new Error('Template not found or access denied.');
        if (!templateData) throw new Error('Template not found.');
        setTemplate(templateData as WorkoutTemplate);

        // Set initial description state
        const initialDesc = templateData?.description ?? '';
        setInitialDescription(initialDesc);
        setCurrentDescription(initialDesc);
        setDescriptionChanged(false);
        setIsEditingDescription(false); // Ensure not in edit mode on load

        if (exercisesError) throw new Error('Could not load exercise library.');
        const fetchedExercises = (exercisesData as ExerciseForForm[]) || [];
        setExercisesForForm(fetchedExercises);

        const newExerciseDetailsMap = new Map<string, { name: string; exercise_type: string }>();
        fetchedExercises.forEach(ex => { newExerciseDetailsMap.set(ex.id, { name: ex.name, exercise_type: ex.exercise_type || 'Other' }); });
        setExerciseDetailsMap(newExerciseDetailsMap);

        if (itemsError) throw new Error('Error loading exercises for this template.');
        const currentRecycledIds = new Set(recycledItems.map(item => item.id));
        const fetchedItems = (itemsData as WorkoutItem[]) || [];
        setInitialTemplateItems(fetchedItems.filter(item => !currentRecycledIds.has(item.id)));

      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError(err.message || 'An unexpected error occurred.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [templateId, supabase, recycledItems]);


  if (loading) { return <div className="container mx-auto p-8">Loading...</div>; }
  if (error) { /* ... error handling ... */ }
  if (!template) { return <div className="container mx-auto p-8">Template not found.</div>; }

  // Handler for the Done button click - Updated for inline confirmation
  const handleDoneClick = () => {
    if (recycledItems.length > 0) {
      setShowDoneConfirmation(true); // Show the inline confirmation UI
    } else {
      router.push('/coach/workouts'); // Use router.push for client-side navigation
    }
    // TODO: Add check for unsaved order changes here if needed in the future
  };

  // Handler for "Delete & Finish" button in the confirmation UI
  const handleConfirmDeleteAndFinish = async () => {
      const deleteSuccess = await handleEmptyRecycleBin();
      if (deleteSuccess) { router.push('/coach/workouts'); }
      else { setShowDoneConfirmation(true); }
  };

  // Handler for "Review Bin" button in the confirmation UI
  const handleReviewBin = () => {
      setShowDoneConfirmation(false);
      setShowRecycleBin(true);
  };

  // Handler for "Cancel" button in the confirmation UI
  const handleCancelDone = () => {
      setShowDoneConfirmation(false);
  };


  return (
    <div className="container mx-auto p-8">
      <div className="flex justify-between items-center mb-4">
          {/* Done Button */}
          <Button variant="outline" size="sm" onClick={handleDoneClick} disabled={isPermanentlyDeleting}>
             {isPermanentlyDeleting ? 'Processing...' : 'Done'}
          </Button>
      </div>

      {/* Title and Editable Description */}
      <div className="flex items-center space-x-2 mb-1">
        <h1 className="text-3xl font-bold">Edit Workout: {template.name}</h1>
        <FilePenLine className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="mb-6 relative group"> {/* Add group for hover effect */}
          {isEditingDescription ? (
              <>
                  <Textarea
                      value={currentDescription}
                      onChange={handleDescriptionChange}
                      placeholder="Add a description for this workout template..."
                      className="text-muted-foreground pr-24 min-h-[60px]" // Ensure min height
                      rows={2}
                      autoFocus // Focus when appearing
                      onBlur={() => { // Optional: Save on blur if changed, or just exit edit mode
                          // For simplicity, let's exit edit mode on blur if no changes were made
                          if (!descriptionChanged) {
                              setIsEditingDescription(false);
                          }
                          // Require explicit save button click for changes
                      }}
                  />
                  {descriptionChanged && (
                      <Button
                          size="sm"
                          onClick={handleSaveDescription}
                          disabled={isSavingDescription}
                          className="absolute bottom-2 right-2"
                      >
                          {isSavingDescription ? 'Saving...' : <><Save className="mr-1 h-4 w-4" /> Save Desc.</>}
                      </Button>
                  )}
              </>
          ) : (
              <div
                  onClick={() => setIsEditingDescription(true)}
                  className="text-muted-foreground whitespace-pre-wrap min-h-[60px] p-2 border border-transparent rounded-md cursor-text hover:border-input" // Mimic textarea padding/border on hover
              >
                  {currentDescription || <span className="italic">Add a description...</span>}
              </div>
          )}
      </div>
      {saveDescriptionError && <p className="text-destructive mb-2 text-sm">{saveDescriptionError}</p>}
      {saveDescriptionMessage && <p className="text-green-600 mb-2 text-sm">{saveDescriptionMessage}</p>}


       <AuthMessages />

       {/* Inline Confirmation UI for Done Button */}
       {showDoneConfirmation && (
           <div className="mb-4 rounded-md border border-destructive bg-destructive/10 p-4 text-sm">
               <div className="flex items-start space-x-3">
                   <AlertTriangle className="h-5 w-5 flex-shrink-0 text-destructive" />
                   <div className="flex-grow">
                       <p className="font-medium text-destructive">
                           You have {recycledItems.length} item(s) in the recycle bin.
                       </p>
                       <p className="text-destructive/90 mt-1">
                           Permanently delete these items before finishing?
                       </p>
                       {recycleBinError && <p className="text-destructive mt-1 font-semibold">Error: {recycleBinError}</p>}
                       <div className="mt-3 flex space-x-3">
                           <Button
                               variant="destructive"
                               size="sm"
                               onClick={handleConfirmDeleteAndFinish}
                               disabled={isPermanentlyDeleting}
                           >
                               {isPermanentlyDeleting ? 'Deleting...' : 'Delete & Finish'}
                           </Button>
                           <Button variant="secondary" size="sm" onClick={handleReviewBin} disabled={isPermanentlyDeleting}>
                               Review Bin
                           </Button>
                           <Button variant="outline" size="sm" onClick={handleCancelDone} disabled={isPermanentlyDeleting}>
                               Cancel
                           </Button>
                       </div>
                   </div>
               </div>
           </div>
       )}

       {/* Workout Item List */}
       <WorkoutItemList
         initialItems={initialTemplateItems} // Pass the potentially filtered initial items
         exerciseDetailsMap={exerciseDetailsMap}
         allExercises={exercisesForForm}
         templateId={templateId}
         onRecycleItems={handleRecycleItems} // Pass down callback
       />

      {/* Collapsible Add Exercise Form */}
      <Collapsible
        open={isAddFormOpen}
        onOpenChange={setIsAddFormOpen}
        className="mt-8 pt-8 border-t border-border"
      >
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-center text-sm">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Exercise Item
            <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          {exercisesForForm.length === 0 ? (
             <p className="text-muted-foreground text-center">
                 You need to add exercises to your <Link href="/coach/exercises/add" className="text-primary underline">library</Link> first.
             </p>
          ) : (
            <AddWorkoutItemForm templateId={templateId} exercises={exercisesForForm} />
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Collapsible Recycle Bin Section (Moved to Page) */}
      {recycledItems.length > 0 && (
          <Collapsible
              open={showRecycleBin}
              onOpenChange={setShowRecycleBin}
              className="mt-8 pt-4 border-t border-dashed border-destructive/50"
          >
              <div className="flex justify-between items-center mb-2">
                  <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="flex items-center text-lg font-semibold text-destructive p-0 hover:bg-transparent">
                          <Trash2 className="mr-2 h-5 w-5" />
                          Recycle Bin ({recycledItems.length})
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                  </CollapsibleTrigger>
                  {recycledItems.length > 0 && (
                      <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleEmptyRecycleBin}
                          disabled={isPermanentlyDeleting}
                      >
                          {isPermanentlyDeleting ? 'Deleting...' : 'Empty Recycle Bin'}
                      </Button>
                  )}
              </div>
              <CollapsibleContent className="mt-2 space-y-2">
                  {recycleBinError && <p className="text-destructive mb-2 text-sm">{recycleBinError}</p>}
                  {recycledItems.length === 0 ? (
                     <p className="text-muted-foreground text-sm italic pl-1">Recycle bin is empty.</p>
                  ) : (
                     <ul className="space-y-2">
                      {recycledItems.map((item) => {
                          const details = exerciseDetailsMap.get(item.exercise_id); // Use map from page state
                          const name = details?.name ?? 'Unknown Exercise';
                          return (
                              <li key={item.id} className="flex justify-between items-center p-2 border rounded bg-muted/30">
                                  <span className="text-sm">{name} (Order: {item.item_order})</span>
                                  <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRestoreItem(item.id)}
                                      disabled={isPermanentlyDeleting} // Disable restore during permanent delete
                                      className="text-xs h-7 px-2"
                                  >
                                      <RotateCcw className="mr-1 h-3 w-3" /> Restore
                                  </Button>
                              </li>
                          );
                      })}
                     </ul>
                  )}
              </CollapsibleContent>
          </Collapsible>
      )}

    </div>
  );
}
