'use client';

import React, { useState, useTransition, useCallback } from 'react'; // Import useCallback
import { deleteWorkoutItem, duplicateWorkoutItem } from '@/app/coach/actions'; // Import duplicate action
import EditWorkoutItemModal from './EditWorkoutItemModal';
import { ArrowUp, ArrowDown, Copy } from 'lucide-react'; // Import Copy icon
import { Checkbox } from '@/components/ui/checkbox'; // Assuming Checkbox component exists
import { Button } from '@/components/ui/button'; // Import Button
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Import Tooltip components

// Types
type Exercise = {
  id: string;
  name: string;
  body_part: string;
  machine_type: string;
  exercise_type: string;
};

type SetDetail = {
  set: number;
  reps: string; // e.g., "8-12"
  weight: string; // e.g., "50 kg", "BW"
  time: string; // e.g., "60 sec", "AMRAP"
  rest: string; // e.g., "90 sec"
  // Add new fields
  resistance?: string | null; // e.g., "Level 5"
  speed?: string | null; // e.g., "10 km/h"
  incline?: string | null; // e.g., "5%"
};

type WorkoutItem = {
  id: string;
  template_id: string;
  exercise_id: string;
  alternative_exercise_id: string | null;
  superset_exercise_id?: string | null; // Added superset ID
  sets: number | null;
  notes: string | null;
  set_details: any | null;
  alt_set_details?: any | null;
  superset_set_details?: any | null; // Added superset details
  updated_at: string;
  item_order: number;
};

interface WorkoutItemDisplayProps {
  item: WorkoutItem;
  exerciseName: string;
  altExerciseName: string | null;
  allExercises: Exercise[];
  groupIndex: number;
  onMove: (itemId: string, direction: 'up' | 'down') => void;
  isFirst: boolean;
  isLast: boolean;
  isPending?: boolean;
  exerciseDetailsMap: Map<string, { name: string; exercise_type: string }>;
  // Props for multi-select delete
  deleteMode: boolean;
  isSelected: boolean;
  onSelectItem: (itemId: string, isSelected: boolean) => void;
  // Prop for single delete handling
  onSingleDelete: (itemId: string) => void;
  isDeletingSingle?: boolean; // Optional prop to show single delete pending state
  // Add templateId prop needed for duplication action
  templateId: string;
  // Callback for when duplication succeeds to trigger list refresh
  onDuplicateSuccess: () => void;
}

export default function WorkoutItemDisplay({
  item,
  exerciseName,
  altExerciseName,
  allExercises,
  groupIndex,
  onMove,
  isFirst,
  isLast,
  isPending,
  exerciseDetailsMap,
  // Destructure delete props
  deleteMode,
  isSelected,
  onSelectItem,
  // Destructure single delete props
  onSingleDelete,
  isDeletingSingle,
  // Destructure templateId
  templateId,
  // Destructure callback
  onDuplicateSuccess
}: WorkoutItemDisplayProps) {

  const [isDetailsVisible, setIsDetailsVisible] = useState(false);
  const [isDuplicating, startDuplicateTransition] = useTransition(); // Transition for duplication
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false); // State for confirmation visibility
  // Note: isDeleting and startDeleteTransition were related to the old window.confirm logic,
  // they are not strictly needed now as the pending state is handled by isDeletingSingle prop.
  // Keeping them for now in case other logic relies on them, but could be removed if confirmed unused.
  const [isDeleting, startDeleteTransition] = useTransition();
  const [error, setError] = useState<string | null>(null); // General error state
  const [duplicateError, setDuplicateError] = useState<string | null>(null); // Specific error for duplication
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null); // Success message for duplication
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showPrimaryExercise, setShowPrimaryExercise] = useState(true);

  const toggleDetails = () => setIsDetailsVisible(!isDetailsVisible);

  // Function to safely parse JSONB details
  const parseDetails = (detailsData: any): SetDetail[] => {
      let parsed: SetDetail[] = [];
      if (detailsData) {
          try {
              let rawParsed = typeof detailsData === 'string' ? JSON.parse(detailsData) : detailsData;
              if (Array.isArray(rawParsed)) {
                  parsed = rawParsed.map((d, i) => ({
                      set: d.set ?? i + 1,
                      reps: d.reps ?? '',
                      weight: d.weight ?? '',
                      time: d.time ?? '',
                      rest: d.rest ?? '',
                      resistance: d.resistance ?? null, // Parse new fields, default to null
                      speed: d.speed ?? null,
                      incline: d.incline ?? null,
                  }));
              }
          } catch (e) {
              console.error("Failed to parse details:", e);
          }
      }
      // Ensure it's always an array, even if parsing failed or data was null/not array
      return Array.isArray(parsed) ? parsed : [];
  };

  const setDetailsArray = parseDetails(item.set_details);
  const altSetDetailsArray = parseDetails(item.alt_set_details); // Use parsed alt details
  const supersetSetDetailsArray = parseDetails(item.superset_set_details); // Parse superset details

  const toggleExerciseDisplay = () => {
      if (altExerciseName) setShowPrimaryExercise(!showPrimaryExercise);
  };

  const openEditModal = () => {
    setError(null);
    setIsEditModalOpen(true);
  };

  // Use the passed-in handler for single delete
  const handleDelete = () => {
      setError(null);
      setDuplicateError(null); // Clear duplicate error too
      onSingleDelete(item.id); // Call the handler passed from WorkoutItemList
  };

  // Handler to show duplication confirmation
  const handleDuplicate = useCallback(() => {
      setError(null);
      setDuplicateError(null);
      setDuplicateMessage(null);
      setShowDuplicateConfirm(true); // Show confirmation prompt
  }, []);

  // Handler to cancel duplication
  const cancelDuplicate = () => {
      setShowDuplicateConfirm(false);
      setDuplicateError(null);
  };

  // Handler to confirm and execute duplication
  const confirmDuplicate = useCallback(() => {
      setShowDuplicateConfirm(false);
      setDuplicateError(null);
      setDuplicateMessage(null);
      startDuplicateTransition(async () => {
          const result = await duplicateWorkoutItem(item.id, templateId);
          if (!result.success) {
              console.error("Failed to duplicate item:", result.error);
              setDuplicateError(result.error || 'Failed to duplicate item.');
          } else {
              console.log("Item duplicated successfully");
              setDuplicateMessage(result.message || 'Item duplicated.');
              onDuplicateSuccess(); // Call the callback to notify parent
              // Hide message after a delay
              setTimeout(() => setDuplicateMessage(null), 3000);
          }
      });
  }, [item.id, templateId, onDuplicateSuccess]);


  const displayExerciseName = showPrimaryExercise ? exerciseName : altExerciseName;
  const displaySetDetails = showPrimaryExercise ? setDetailsArray : altSetDetailsArray;
  // Updated labels as per request
  const displayDetailsLabel = item.alternative_exercise_id ? (showPrimaryExercise ? 'Exercise Details:' : 'Alternative Exercise Details:') : 'Exercise Details:';
  const toggleButtonText = showPrimaryExercise ? `Alt: ${altExerciseName}` : `Pri: ${exerciseName}`;
  // Correctly look up the superset exercise name from the map, fallback to "Unknown Superset"
  const supersetExerciseName = item.superset_exercise_id ? (exerciseDetailsMap.get(item.superset_exercise_id)?.name ?? 'Unknown Superset') : null;
  const supersetDetailsLabel = 'Superset Exercise Details:'; // Label for superset

  // Determine if any details exist to show the toggle button
  const hasAnyDetails = setDetailsArray.length > 0 || altSetDetailsArray.length > 0 || supersetSetDetailsArray.length > 0;

  return (
    <li className={`border-b border-border pb-3 pt-2 list-none ${isPending ? 'opacity-70' : ''} ${deleteMode ? 'pl-2 pr-1' : ''}`}>
      <div className="flex items-center justify-between space-x-2">
         {/* Checkbox (only in delete mode) */}
         {deleteMode && (
            <div className="flex-shrink-0 mr-2">
                 <Checkbox
                     id={`select-${item.id}`}
                     checked={isSelected}
                     // Explicitly type 'checked' as boolean | 'indeterminate' (Checkbox state)
                     onCheckedChange={(checked: boolean | 'indeterminate') => onSelectItem(item.id, !!checked)}
                     aria-label={`Select ${exerciseName} for deletion`}
                     disabled={isPending}
                />
            </div>
         )}

         {/* Left side: Exercise Info & Details Toggle */}
         <div className="flex-grow pr-2">
            <span className="font-semibold">{groupIndex + 1}. {displayExerciseName}</span>
            {altExerciseName && (
                <button onClick={toggleExerciseDisplay} disabled={deleteMode || isPending} className="ml-1 text-xs text-muted-foreground hover:text-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed" title={`Switch to ${showPrimaryExercise ? altExerciseName : exerciseName}`}>({toggleButtonText})</button>
            )}
            <span className="text-sm text-muted-foreground"> - {item.sets ?? 0} Sets</span>
            {hasAnyDetails && ( // Use combined check
                <button onClick={toggleDetails} disabled={deleteMode || isPending} className="ml-3 text-xs text-primary hover:underline focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed">{isDetailsVisible ? 'Hide Details' : 'Show Details'}</button>
            )}
            {/* Display Superset Name */}
            {supersetExerciseName && supersetExerciseName !== 'Unknown Superset' && ( // Only display if name is found
                 <span className="block pl-0 text-sm text-muted-foreground italic mt-1">+ Superset: {supersetExerciseName}</span>
             )}
             {/* Display Notes */}
             {item.notes && (
                 <p className="pl-0 text-xs text-muted-foreground mt-1">Notes: {item.notes}</p>
             )}
             {/* Display Last Updated */}
             {item.updated_at && (
               <div className="pl-0 text-xs text-muted-foreground/80 mt-1">Last updated: {new Date(item.updated_at).toLocaleString()}</div>
             )}
        </div>

        {/* Right side: Action Buttons */}
         {/* Right side: Action Buttons (conditionally rendered/disabled) */}
         <div className="space-x-1 flex-shrink-0 flex items-center">
             {!deleteMode && (
                 <>
                      <button onClick={() => onMove(item.id, 'up')} disabled={isFirst || isPending || isDuplicating} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none" aria-label="Move item up" title="Move Up"><ArrowUp size={16} /></button>
                      <button onClick={() => onMove(item.id, 'down')} disabled={isLast || isPending || isDuplicating} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none" aria-label="Move item down" title="Move Down"><ArrowDown size={16} /></button>
                      {/* Duplicate Button - Triggers confirmation */}
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                             <button
                               onClick={handleDuplicate} // Show confirmation
                               disabled={isPending || isDuplicating || isDeletingSingle}
                               className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none"
                               aria-label="Duplicate item"
                             >
                               <Copy size={16} />
                             </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Duplicate</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <button className="text-xs text-blue-600 hover:underline focus:outline-none px-1 disabled:opacity-50 disabled:cursor-not-allowed" onClick={openEditModal} disabled={isPending || isDuplicating || isDeletingSingle}>Edit</button>
                      {/* Use isDeletingSingle prop for pending state */}
                      <button className={`text-xs text-destructive hover:underline focus:outline-none ${isDeletingSingle ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={handleDelete} disabled={isDeletingSingle || isPending || isDuplicating}>{isDeletingSingle ? 'Deleting...' : 'Delete'}</button>
                 </>
             )}
             {/* Placeholder or adjust spacing if needed when deleteMode is true */}
             {deleteMode && <div className="w-0 h-0"></div>}
        </div>
      </div>

      {/* Conditionally Rendered Details Tables */}
      {isDetailsVisible && hasAnyDetails && ( // Use combined check
        <div className={`mt-2 space-y-3 ${deleteMode ? 'pl-8' : 'pl-4'}`}> {/* Indent details section, more if checkbox visible */}
          {/* Primary or Alternative Details Table */}
          {displaySetDetails.length > 0 && (
            <div>
               <p className="text-xs font-medium text-muted-foreground mb-1">{displayDetailsLabel}</p>
               <table className="w-full text-xs">
                 <thead>
                   <tr className="text-muted-foreground">
                     <th className="pr-2 text-left font-medium">Set</th>
                     <th className="px-1 text-left font-medium">Reps</th>
                     <th className="px-1 text-left font-medium">Weight</th>
                     <th className="px-1 text-left font-medium">Time</th>
                     <th className="px-1 text-left font-medium">Rest</th>
                     <th className="px-1 text-left font-medium">Resist.</th>
                     <th className="px-1 text-left font-medium">Speed</th>
                     <th className="pl-1 text-left font-medium">Incline</th>
                   </tr>
                 </thead>
                 <tbody>
                   {displaySetDetails.map((sd, index) => (
                     <tr key={`detail-${index}`} className="border-t border-border/50">
                       <td className="pr-2 py-0.5">{sd.set ?? index + 1}</td>
                       <td className="px-1 py-0.5">{sd.reps || '-'}</td>
                       <td className="px-1 py-0.5">{sd.weight || '-'}</td>
                       <td className="px-1 py-0.5">{sd.time || '-'}</td>
                       <td className="px-1 py-0.5">{sd.rest || '-'}</td>
                       <td className="px-1 py-0.5">{sd.resistance || '-'}</td>
                       <td className="px-1 py-0.5">{sd.speed || '-'}</td>
                       <td className="pl-1 py-0.5">{sd.incline || '-'}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>
          )}
           {/* Superset Details Table */}
           {supersetExerciseName && supersetExerciseName !== 'Unknown Superset' && supersetSetDetailsArray.length > 0 && ( // Render only if name exists and details exist
             <div>
               <p className="text-xs font-medium text-muted-foreground mb-1 mt-2">{supersetDetailsLabel} ({supersetExerciseName}):</p>
               <table className="w-full text-xs">
                  <thead>
                   <tr className="text-muted-foreground">
                     <th className="pr-2 text-left font-medium">Set</th>
                     <th className="px-1 text-left font-medium">Reps</th>
                     <th className="px-1 text-left font-medium">Weight</th>
                     <th className="px-1 text-left font-medium">Time</th>
                     <th className="px-1 text-left font-medium">Rest</th>
                     <th className="px-1 text-left font-medium">Resist.</th>
                     <th className="px-1 text-left font-medium">Speed</th>
                     <th className="pl-1 text-left font-medium">Incline</th>
                   </tr>
                 </thead>
                 <tbody>
                   {supersetSetDetailsArray.map((sd, index) => (
                     <tr key={`superset-${index}`} className="border-t border-border/50">
                       <td className="pr-2 py-0.5">{sd.set ?? index + 1}</td>
                       <td className="px-1 py-0.5">{sd.reps || '-'}</td>
                       <td className="px-1 py-0.5">{sd.weight || '-'}</td>
                       <td className="px-1 py-0.5">{sd.time || '-'}</td>
                       <td className="px-1 py-0.5">{sd.rest || '-'}</td>
                       <td className="px-1 py-0.5">{sd.resistance || '-'}</td>
                       <td className="px-1 py-0.5">{sd.speed || '-'}</td>
                       <td className="pl-1 py-0.5">{sd.incline || '-'}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           )}
        </div>
      )}
      {/* Confirmation Dialog Area */}
      {showDuplicateConfirm && (
          <div className="mt-2 pl-4 text-xs flex items-center space-x-2">
              <span className="text-orange-600">Duplicate this item?</span>
              <Button variant="outline" size="sm" onClick={confirmDuplicate} disabled={isDuplicating} className="h-6 px-2 text-xs"> {/* Use sm size and adjust padding/height */}
                  {isDuplicating ? 'Duplicating...' : 'Confirm'}
              </Button>
              <Button variant="ghost" size="sm" onClick={cancelDuplicate} disabled={isDuplicating} className="h-6 px-2 text-xs"> {/* Use sm size and adjust padding/height */}
                  Cancel
              </Button>
          </div>
      )}
      {/* Display Duplicate Error/Success */}
      {duplicateError && <p className="mt-1 pl-4 text-xs text-destructive">Duplicate Error: {duplicateError}</p>}
      {duplicateMessage && <p className="mt-1 pl-4 text-xs text-green-600">{duplicateMessage}</p>}
      {error && <p className="mt-1 pl-4 text-xs text-destructive">{error}</p>} {/* Keep general error display */}


      {/* Render the Edit Modal */}
      <EditWorkoutItemModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        item={item}
        allExercises={allExercises}
      />
    </li>
  );
}
