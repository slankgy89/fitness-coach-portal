'use client';

import React, { useState, useTransition, useCallback, useEffect } from 'react';
import WorkoutItemDisplay from './WorkoutItemDisplay';
import { createClient } from '@/lib/supabase/client';
import { moveWorkoutItem, moveWorkoutGroup, deleteMultipleWorkoutItems, deleteWorkoutItem, duplicateWorkoutItem, updateWorkoutTemplateItemOrder } from '@/app/coach/actions'; // Import update order action
import { ArrowUp, ArrowDown, Trash2, XCircle, RotateCcw, AlertTriangle, ChevronsUpDown, Save, Undo2 } from 'lucide-react'; // Add Save, Undo2 icons
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// Define types locally as fallback
type ExerciseForForm = { id: string; name: string; body_part: string; machine_type: string; exercise_type: string; };
type WorkoutItem = { id: string; template_id: string; exercise_id: string; alternative_exercise_id: string | null; superset_exercise_id?: string | null; sets: number | null; notes: string | null; set_details: any | null; alt_set_details?: any | null; superset_set_details?: any | null; updated_at: string; item_order: number; };

interface WorkoutItemListProps {
  initialItems: WorkoutItem[];
  exerciseDetailsMap: Map<string, { name: string; exercise_type: string }>;
  allExercises: ExerciseForForm[];
  templateId: string;
  onRecycleItems: (itemsToRecycle: WorkoutItem[]) => void; // Add callback prop type
}

export default function WorkoutItemList({
  initialItems: serverInitialItems,
  exerciseDetailsMap,
  allExercises,
  templateId,
  onRecycleItems, // Destructure the new prop
}: WorkoutItemListProps) {
  // State for items
  const [items, setItems] = useState<WorkoutItem[]>(() => [...serverInitialItems].sort((a, b) => a.item_order - b.item_order));
  const [recycledItems, setRecycledItems] = useState<WorkoutItem[]>([]); // State for Recycle Bin

  const [isMoving, startMoveTransition] = useTransition();
  const [isDeletingMultiple, startDeleteMultipleTransition] = useTransition(); // Now used for permanent multi-delete
  const [isDeletingSingle, startDeleteSingleTransition] = useTransition(); // Not used for recycle bin move
  const [isRestoring, startRestoreTransition] = useTransition(); // Transition for restoring
  const [isPermanentlyDeleting, startPermanentDeleteTransition] = useTransition(); // Transition for permanent delete

  const [moveError, setMoveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null); // Error during recycle bin operation or multi-delete confirm
  // const [singleDeleteError, setSingleDeleteError] = useState<string | null>(null); // No longer needed for single delete
  const [recycleBinError, setRecycleBinError] = useState<string | null>(null); // Specific errors for restore/permanent delete

  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showMultiDeleteConfirm, setShowMultiDeleteConfirm] = useState(false); // Now confirms moving to recycle bin
  const [showRecycleBin, setShowRecycleBin] = useState(false); // Toggle visibility of recycle bin UI
  // --- State for Order Save/Restore ---
  const [initialOrderIds, setInitialOrderIds] = useState<string[]>([]);
  const [orderChanged, setOrderChanged] = useState(false);
  const [isSavingOrder, startSaveOrderTransition] = useTransition();
  const [saveOrderError, setSaveOrderError] = useState<string | null>(null);
  const [saveOrderMessage, setSaveOrderMessage] = useState<string | null>(null);

  // Effect to store initial order
  useEffect(() => {
    setInitialOrderIds(serverInitialItems.map(item => item.id));
  }, [serverInitialItems]);

  // Effect to detect order changes
  useEffect(() => {
    const currentOrderIds = items.map(item => item.id);
    // Simple length check first
    if (currentOrderIds.length !== initialOrderIds.length) {
      setOrderChanged(true);
      return;
    }
    // Check if IDs at each position match
    const hasOrderChanged = currentOrderIds.some((id, index) => id !== initialOrderIds[index]);
    setOrderChanged(hasOrderChanged);
    if (!hasOrderChanged) {
        setSaveOrderError(null); // Clear error if order is restored
        setSaveOrderMessage(null); // Clear message if order is restored
    }
  }, [items, initialOrderIds]);


  // Memoize grouped items and sorted keys (only for active items)
  const { groupedItems, sortedGroupKeys } = React.useMemo(() => {
      const grouped: Record<string, WorkoutItem[]> = {};
      if (items.length > 0 && exerciseDetailsMap.size > 0) {
          items.forEach(item => {
              const details = exerciseDetailsMap.get(item.exercise_id);
              const type = details?.exercise_type || 'Other';
              if (!grouped[type]) {
                  grouped[type] = [];
              }
              grouped[type].push(item);
          });
      }
      const keys = Object.keys(grouped).sort((a, b) => {
           const minOrderA = Math.min(...(grouped[a]?.map(i => i.item_order) ?? [Infinity]));
           const minOrderB = Math.min(...(grouped[b]?.map(i => i.item_order) ?? [Infinity]));
           return minOrderA - minOrderB;
      });
      const sortedGrouped: Record<string, WorkoutItem[]> = {};
       keys.forEach(key => {
           sortedGrouped[key] = grouped[key].sort((a, b) => a.item_order - b.item_order);
       });

      return { groupedItems: sortedGrouped, sortedGroupKeys: keys };
  }, [items, exerciseDetailsMap]);

  // Item selection handler
  const handleSelectItem = useCallback((itemId: string, isSelected: boolean) => {
      setSelectedItems(prevSelected => {
          const newSelected = new Set(prevSelected);
          if (isSelected) newSelected.add(itemId);
          else newSelected.delete(itemId);
          return newSelected;
      });
  }, []);

  // Toggle delete mode
  const toggleDeleteMode = () => {
      setDeleteMode(!deleteMode);
      setSelectedItems(new Set());
      setDeleteError(null);
      // setSingleDeleteError(null);
      setShowMultiDeleteConfirm(false);
  };

  // Show multi-delete confirmation (now confirms moving to recycle bin)
  const handleDeleteSelected = () => {
      if (selectedItems.size === 0) {
          setDeleteError("No items selected for deletion.");
          return;
      }
      setShowMultiDeleteConfirm(true);
      setDeleteError(null);
  };

  // Confirm and move selected items to recycle bin
  const confirmMoveToRecycleBin = () => {
      setShowMultiDeleteConfirm(false);
      const itemsToRecycleIds = Array.from(selectedItems);
      const itemsToRecycle = items.filter(item => itemsToRecycleIds.includes(item.id));
      const remainingItems = items.filter(item => !itemsToRecycleIds.includes(item.id));

      // Update main list (remove items) and recycle bin list (add items)
      // Update main list state locally
      setItems(remainingItems.map((item, index) => ({ ...item, item_order: index + 1 })));
      // Call parent callback to update recycle bin state
      onRecycleItems(itemsToRecycle);
      setSelectedItems(new Set());
      setDeleteMode(false); // Exit delete mode after moving
  };

  // Cancel multi-delete confirmation
  const cancelMultiDelete = () => {
      setShowMultiDeleteConfirm(false);
  };

  // Handle single item deletion (move to recycle bin)
  const handleSingleDeleteItem = useCallback((itemId: string) => {
      setDeleteError(null); // Clear general delete error
      const itemToRecycle = items.find(item => item.id === itemId);
      if (!itemToRecycle) return;

      const remainingItems = items.filter(item => item.id !== itemId);

      // Update main list state locally
      setItems(remainingItems.map((item, index) => ({ ...item, item_order: index + 1 })));
      // Call parent callback to update recycle bin state
      onRecycleItems([itemToRecycle]);

  }, [items, onRecycleItems]); // Add onRecycleItems dependency

  // Restore item from recycle bin
  const handleRestoreItem = useCallback((itemId: string) => {
      setRecycleBinError(null);
      const itemToRestore = recycledItems.find(item => item.id === itemId);
      if (!itemToRestore) return;

      const remainingRecycled = recycledItems.filter(item => item.id !== itemId);
      // Add back and sort by original order to try and maintain position
      const newItemsList = [...items, itemToRestore].sort((a, b) => a.item_order - b.item_order);

      // Re-assign sequential order based on sorted position
      const updatedItemsWithOrder = newItemsList.map((item, index) => ({ ...item, item_order: index + 1 }));

      // This logic is now handled in the parent (page.tsx)
      // We might need a way for the parent to pass down the updated 'items' list
      // or trigger a refetch within this component if needed after restore.
      // For now, this handler in the child is removed as state is lifted.
      console.log(`Restore called for ${itemId}, but logic is in parent.`);
  }, [recycledItems]); // Dependency removed: items

  // Permanently delete all items from recycle bin
  const handleEmptyRecycleBin = useCallback(() => {
      if (recycledItems.length === 0) return;
      setRecycleBinError(null);
      const idsToDelete = recycledItems.map(item => item.id);

      startPermanentDeleteTransition(async () => {
          const result = await deleteMultipleWorkoutItems(idsToDelete, templateId);
          if (!result.success) {
              console.error("Failed to permanently delete items:", result.error);
              setRecycleBinError(result.error || 'Failed to empty recycle bin.');
          } else {
              console.log("Recycle bin emptied successfully.");
              setRecycledItems([]); // Clear the recycle bin state
          }
      });
  }, [recycledItems, templateId]);

  // Handler to save the current order
  const handleSaveOrder = useCallback(() => {
      setSaveOrderError(null);
      setSaveOrderMessage(null);
      const currentOrderIds = items.map(item => item.id);
      startSaveOrderTransition(async () => {
          const result = await updateWorkoutTemplateItemOrder(templateId, currentOrderIds);
          if (!result.success) {
              console.error("Failed to save order:", result.error);
              setSaveOrderError(result.error || "Failed to save workout order.");
          } else {
              console.log("Order saved successfully");
              setInitialOrderIds(currentOrderIds); // Update initial order to current
              setOrderChanged(false); // Reset changed flag
              setSaveOrderMessage(result.message || "Order saved.");
              setTimeout(() => setSaveOrderMessage(null), 3000); // Clear message after delay
          }
      });
  }, [items, templateId]);

  // Handler to restore the initial order
  const handleRestoreOrder = useCallback(() => {
      // Reset items state based on the initial prop passed to the component
      setItems([...serverInitialItems].sort((a, b) => a.item_order - b.item_order));
      setOrderChanged(false); // Order is now back to initial
      setSaveOrderError(null);
      setSaveOrderMessage(null);
      console.log("Order restored to initial state.");
  }, [serverInitialItems]);


  // Effect to update local items if initialItems prop changes (e.g., after restore from parent)
  useEffect(() => {
      setItems([...serverInitialItems].sort((a, b) => a.item_order - b.item_order));
  }, [serverInitialItems]);


  // Callback for successful duplication - Refetch items
  const handleDuplicateSuccess = useCallback(async () => {
    console.log("Duplicate successful, refetching list...");
    try {
      const supabase = createClient();
      const { data: updatedItems, error: fetchError } = await supabase
        .from('workout_template_items')
        .select('*')
        .eq('template_id', templateId)
        .order('item_order', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }
      setItems((updatedItems as WorkoutItem[]) || []);
      console.log("Workout item list updated after duplication.");
    } catch (error: any) {
      console.error("Error refetching items after duplication:", error);
      setMoveError("Failed to refresh list after duplication. Please refresh manually.");
    }
  }, [templateId]);

  // Handle moving a single item
  const handleMoveItem = (itemId: string, direction: 'up' | 'down') => {
    setMoveError(null);
    const currentIndex = items.findIndex(item => item.id === itemId);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const newItems = [...items];
    const temp = newItems[currentIndex];
    newItems[currentIndex] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    const updatedItemsForState = newItems.map((item, index) => ({
        ...item,
        item_order: index + 1
    }));
    setItems(updatedItemsForState);
  };

  // Handle moving an entire group
  const handleMoveGroup = (exerciseType: string, direction: 'up' | 'down') => {
      setMoveError(null);
      const currentGroupIndex = sortedGroupKeys.indexOf(exerciseType);
      if (currentGroupIndex === -1) return;

      const targetGroupIndex = direction === 'up' ? currentGroupIndex - 1 : currentGroupIndex + 1;
      if (targetGroupIndex < 0 || targetGroupIndex >= sortedGroupKeys.length) return;

      const adjacentGroupType = sortedGroupKeys[targetGroupIndex];
      const groupToMoveItems = items.filter(item => (exerciseDetailsMap.get(item.exercise_id)?.exercise_type || 'Other') === exerciseType);
      const adjacentGroupItems = items.filter(item => (exerciseDetailsMap.get(item.exercise_id)?.exercise_type || 'Other') === adjacentGroupType);
      const otherItems = items.filter(item => {
          const type = exerciseDetailsMap.get(item.exercise_id)?.exercise_type || 'Other';
          return type !== exerciseType && type !== adjacentGroupType;
      });

      const combinedSwappedItems = direction === 'up'
          ? [...groupToMoveItems, ...adjacentGroupItems]
          : [...adjacentGroupItems, ...groupToMoveItems];

      const startOrder = direction === 'up'
          ? Math.min(...adjacentGroupItems.map(i => i.item_order))
          : Math.min(...groupToMoveItems.map(i => i.item_order));

     if (startOrder === undefined || startOrder === Infinity) {
         console.error("Could not determine start order for group move.");
         setMoveError('Calculation error during group move.');
         return;
     }

      const reorderedSwappedItems = combinedSwappedItems.map((item, index) => ({
          ...item,
          item_order: startOrder + index,
      }));

      const newItemsState = [...otherItems, ...reorderedSwappedItems].sort((a, b) => a.item_order - b.item_order)
                                                                    .map((item, index) => ({ ...item, item_order: index + 1 }));

      setItems(newItemsState);
  };


  return (
    <div className="mb-8 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Current Exercises</h2>
        <div className="flex items-center space-x-2">
             {/* Save/Restore Order Buttons */}
             {orderChanged && (
                 <>
                     <Button
                         variant="outline"
                         size="sm"
                         onClick={handleRestoreOrder}
                         disabled={isSavingOrder}
                         className="text-yellow-600 border-yellow-500 hover:bg-yellow-50"
                     >
                         <Undo2 className="mr-2 h-4 w-4" /> Restore Order
                     </Button>
                     <Button
                         size="sm"
                         onClick={handleSaveOrder}
                         disabled={isSavingOrder}
                     >
                         {isSavingOrder ? 'Saving...' : <><Save className="mr-2 h-4 w-4" /> Save Order</>}
                     </Button>
                 </>
             )}
            {/* Select Items Button */}
            {items.length > 0 && (
            <Button
                variant={deleteMode ? "destructive" : "outline"}
                size="sm"
                onClick={toggleDeleteMode}
                disabled={isMoving || isDeletingMultiple || isDeletingSingle || isRestoring || isPermanentlyDeleting || isSavingOrder} // Disable if saving order
            >
                {deleteMode ? <XCircle className="mr-2 h-4 w-4" /> : <Trash2 className="mr-2 h-4 w-4" />}
                {deleteMode ? 'Cancel Selection' : 'Select Items'}
            </Button>
            )}
        </div>
      </div>

      {/* Error/Success Messages */}
      {moveError && <p className="text-destructive mb-1 text-sm">Move Error: {moveError}</p>}
      {deleteError && <p className="text-destructive mb-1 text-sm">Delete Error: {deleteError}</p>}
      {recycleBinError && <p className="text-destructive mb-1 text-sm">Recycle Bin Error: {recycleBinError}</p>}
      {saveOrderError && <p className="text-destructive mb-1 text-sm">Save Order Error: {saveOrderError}</p>}
      {saveOrderMessage && <p className="text-green-600 mb-1 text-sm">{saveOrderMessage}</p>}


      {/* Delete Mode Actions / Confirmation */}
      {deleteMode && items.length > 0 && (
          <div className="flex justify-end items-center space-x-4 p-2 border rounded-md bg-muted/50 mb-4">
              {showMultiDeleteConfirm ? (
                  <>
                      <span className="text-sm text-orange-600">
                          Move {selectedItems.size} item(s) to Recycle Bin?
                      </span>
                      <Button
                          variant="destructive"
                          size="sm"
                          onClick={confirmMoveToRecycleBin} // Changed function
                          disabled={isDeletingMultiple || isDeletingSingle} // Keep existing disable logic for this step
                      >
                          Confirm Move
                      </Button>
                      <Button
                          variant="outline"
                          size="sm"
                          onClick={cancelMultiDelete}
                          disabled={isDeletingMultiple || isDeletingSingle} // Keep existing disable logic for this step
                      >
                          Cancel
                      </Button>
                  </>
              ) : (
                  <>
                      <span className="text-sm text-muted-foreground">{selectedItems.size} item(s) selected</span>
                      <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleDeleteSelected} // This now shows the confirmation
                          disabled={selectedItems.size === 0 || isDeletingMultiple || isDeletingSingle}
                      >
                          {`Move Selected to Bin (${selectedItems.size})`}
                      </Button>
                  </>
              )}
          </div>
      )}

      {/* Empty state */}
      {(items.length === 0 && recycledItems.length === 0) && ( // Show only if both lists are empty
        <p className="text-muted-foreground mt-4">No exercises added yet.</p>
      )}

      {/* Iterate through sorted group keys for ACTIVE items */}
      {sortedGroupKeys.map((exerciseType, groupListIndex) => {
          const isFirstGroup = groupListIndex === 0;
          const isLastGroup = groupListIndex === sortedGroupKeys.length - 1;
          return (
            <React.Fragment key={exerciseType}>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2 border-b border-border pb-1">
                    <h3 className="text-lg font-medium">{exerciseType}</h3>
                    <div className="flex items-center space-x-2">
                         <span className="text-xs text-muted-foreground">Move Group:</span>
                         <Button
                           variant="ghost" size="icon"
                           onClick={() => handleMoveGroup(exerciseType, 'up')}
                           disabled={isFirstGroup || isMoving || deleteMode || isDeletingSingle || isDeletingMultiple || isRestoring || isPermanentlyDeleting || isSavingOrder} // Disable if saving order
                           className="p-1 h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                           aria-label={`Move ${exerciseType} group up`}
                           title="Move Group Up"
                         >
                           <ArrowUp size={16} />
                         </Button>
                         <Button
                           variant="ghost" size="icon"
                           onClick={() => handleMoveGroup(exerciseType, 'down')}
                           disabled={isLastGroup || isMoving || deleteMode || isDeletingSingle || isDeletingMultiple || isRestoring || isPermanentlyDeleting || isSavingOrder} // Disable if saving order
                           className="p-1 h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                           aria-label={`Move ${exerciseType} group down`}
                           title="Move Group Down"
                         >
                           <ArrowDown size={16} />
                         </Button>
                    </div>
                </div>
                <ol className="pl-0 space-y-1 list-none">
                  {groupedItems[exerciseType].map((item, groupIndex) => {
                    const exerciseDetails = exerciseDetailsMap.get(item.exercise_id);
                    const exerciseName = exerciseDetails?.name ?? 'Unknown Exercise';
                    const altExerciseName = item.alternative_exercise_id ? (exerciseDetailsMap.get(item.alternative_exercise_id)?.name ?? 'Unknown Alt') : null;
                    const overallIndex = items.findIndex(i => i.id === item.id);
                    const isFirstItem = overallIndex === 0;
                    const isLastItem = overallIndex === items.length - 1;

                    return (
                      <WorkoutItemDisplay
                        key={item.id}
                        item={item}
                        exerciseName={exerciseName}
                        altExerciseName={altExerciseName}
                        allExercises={allExercises}
                        groupIndex={groupIndex}
                        onMove={handleMoveItem}
                        isFirst={isFirstItem}
                        isLast={isLastItem}
                        isPending={isMoving || isDeletingMultiple || isDeletingSingle || isRestoring || isPermanentlyDeleting || isSavingOrder} // Disable actions during save order
                        exerciseDetailsMap={exerciseDetailsMap}
                        deleteMode={deleteMode}
                        isSelected={selectedItems.has(item.id)}
                        onSelectItem={handleSelectItem}
                        onSingleDelete={handleSingleDeleteItem} // This now moves to recycle bin
                        isDeletingSingle={false} // No longer directly deleting single items visually
                        templateId={templateId}
                        onDuplicateSuccess={handleDuplicateSuccess}
                      />
                    );
                  })}
                </ol>
              </div>
            </React.Fragment>
          );
      })}

      {/* Collapsible Recycle Bin Section */}
      {recycledItems.length > 0 && ( // Only show collapsible if there are items
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
                  {/* Content of the recycle bin */}
                  {recycledItems.length === 0 ? (
                     <p className="text-muted-foreground text-sm italic pl-1">Recycle bin is empty.</p> // Should not happen if outer check works, but safe fallback
                  ) : (
                     <ul className="space-y-2">
                      {recycledItems.map((item) => {
                          const details = exerciseDetailsMap.get(item.exercise_id);
                          const name = details?.name ?? 'Unknown Exercise';
                          return (
                              <li key={item.id} className="flex justify-between items-center p-2 border rounded bg-muted/30">
                                  <span className="text-sm">{name} (Order: {item.item_order})</span>
                                  <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRestoreItem(item.id)}
                                      disabled={isRestoring || isPermanentlyDeleting}
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
