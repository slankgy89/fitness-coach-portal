'use client';

import React, { useState, useTransition, useEffect, useMemo } from 'react'; // Added useMemo
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Trash2, Edit, PlusCircle, Loader2, AlertCircle, ChevronsUpDown } from 'lucide-react'; // Added ChevronsUpDown
import { MealWithItems, MealItemWithFood } from './page'; // Import types from the page component
import { AddMealItemForm } from '../edit/AddMealItemForm'; // Adjust path if needed
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; // Import RadioGroup for week selector
import { cn } from '@/lib/utils';
import { Database } from '@/lib/database.types'; // Import Database types
import {
  addNutritionProgramMeal,
  updateNutritionProgramMeal, // Keep if needed for renaming meals later
  deleteNutritionProgramMeal,
  addNutritionProgramMealItem,
  updateNutritionProgramMealItem,
  deleteNutritionProgramMealItem,
  importUsdaFood,
  addManualFood,
  addMealTemplateItemsToProgram // Import the new action
} from '@/app/coach/actions';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible" // Import Collapsible

type ProgramTemplate = Database['public']['Tables']['nutrition_program_templates']['Row'];
type MealTemplate = Database['public']['Tables']['meals']['Row']; // Type for saved meal templates

// Define the props based on what's passed from structure/page.tsx
interface NutritionProgramStructureEditorProps {
  program: ProgramTemplate;
  initialMeals: MealWithItems[];
  mealTemplates: MealTemplate[]; // Add prop for saved meal templates
  duration_value: number | null; // Added duration props
  duration_unit: 'days' | 'weeks' | 'months' | null; // Added duration props
  addMealAction: typeof addNutritionProgramMeal;
  // updateMealAction: typeof updateNutritionProgramMeal; // Keep if needed
  deleteMealAction: typeof deleteNutritionProgramMeal;
  addMealItemAction: typeof addNutritionProgramMealItem;
  updateMealItemAction: typeof updateNutritionProgramMealItem;
  deleteMealItemAction: typeof deleteNutritionProgramMealItem;
  importFoodAction: typeof importUsdaFood;
  addMealTemplateItemsAction: typeof addMealTemplateItemsToProgram; // Add the new action prop type
}

// Simplified ActionResult for this component
type ActionResult = { success: boolean; error?: string; message?: string };

export default function NutritionProgramStructureEditor({
    program,
    initialMeals,
    duration_value,
    duration_unit,
    addMealAction,
    // updateMealAction, // Uncomment if meal renaming is implemented here
    deleteMealAction,
    addMealItemAction,
    updateMealItemAction,
    deleteMealItemAction,
    importFoodAction,
    mealTemplates,
    addMealTemplateItemsAction // Destructure new action prop
}: NutritionProgramStructureEditorProps) {
  const [meals, setMeals] = useState<MealWithItems[]>(initialMeals);
  const [isPending, startTransition] = useTransition();
  const [actionResult, setActionResult] = useState<ActionResult | null>(null);
  const [addingItemToMealId, setAddingItemToMealId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<MealItemWithFood | null>(null);
  const [isEditItemModalOpen, setIsEditItemModalOpen] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number>(1); // State for selected week

  // --- Data Grouping (Memoized) ---
  const { mealsByDay, daysByWeek, totalWeeks, allDaysSorted } = useMemo(() => {
      const groupedMealsByDay = meals.reduce((acc, meal) => {
          const day = meal.day_number;
          if (!acc[day]) acc[day] = [];
          acc[day].push(meal);
          acc[day].sort((a, b) => a.meal_order - b.meal_order);
          return acc;
      }, {} as Record<number, MealWithItems[]>);

      const sortedDays = Object.keys(groupedMealsByDay).map(Number).sort((a, b) => a - b);

      const groupedDaysByWeek = sortedDays.reduce((acc, day) => {
          const week = Math.ceil(day / 7);
          if (!acc[week]) acc[week] = [];
          acc[week].push(day);
          return acc;
      }, {} as Record<number, number[]>);

      // Calculate total weeks based on duration or highest day number
      let calculatedTotalWeeks = 1; // Default to 1 week
      if (duration_value && duration_unit) {
          if (duration_unit === 'weeks') {
              calculatedTotalWeeks = duration_value;
          } else if (duration_unit === 'months') {
              calculatedTotalWeeks = duration_value * 4; // Approximation
          } else { // days
              calculatedTotalWeeks = Math.ceil(duration_value / 7);
          }
      } else if (sortedDays.length > 0) {
          // Fallback if duration not set: calculate based on highest day
          calculatedTotalWeeks = Math.ceil(Math.max(...sortedDays) / 7);
      }
      // Ensure at least 1 week is shown even if empty
      calculatedTotalWeeks = Math.max(1, calculatedTotalWeeks);


      return {
          mealsByDay: groupedMealsByDay,
          daysByWeek: groupedDaysByWeek,
          totalWeeks: calculatedTotalWeeks,
          allDaysSorted: sortedDays
      };
  }, [meals, duration_value, duration_unit]);

  const weeks = Array.from({ length: totalWeeks }, (_, i) => i + 1); // Generate array [1, 2, ..., totalWeeks]
  const daysInSelectedWeek = daysByWeek[selectedWeek] || [];
  const nextDayNumber = allDaysSorted.length > 0 ? Math.max(...allDaysSorted) + 1 : 1;

  // --- Handlers ---
  const handleAddDay = () => {
     const formData = new FormData();
     formData.append('programTemplateId', program.id);
     formData.append('dayNumber', nextDayNumber.toString());
     formData.append('mealName', 'Breakfast'); // Default meal name
     startTransition(async () => {
        setActionResult(null);
        const result = await addMealAction(formData);
        setActionResult(result);
        if (result.success && result.newMeal) {
            const mealToAdd: MealWithItems = {
                ...result.newMeal,
                nutrition_program_meal_items: []
            };
            setMeals(prevMeals => [...prevMeals, mealToAdd]);
            const newWeek = Math.ceil(nextDayNumber / 7);
            setSelectedWeek(newWeek); // Switch view to the new week
        }
     });
  };

   const handleAddMeal = (dayNumber: number) => {
     const mealName = prompt(`Enter name for new meal on Day ${dayNumber}:`, `Meal ${ (mealsByDay[dayNumber]?.length || 0) + 1}`);
     if (!mealName || mealName.trim() === '') return;
     const formData = new FormData();
     formData.append('programTemplateId', program.id);
     formData.append('dayNumber', dayNumber.toString());
     formData.append('mealName', mealName);
     startTransition(async () => {
        setActionResult(null);
        const result = await addMealAction(formData);
        setActionResult(result);
        if (result.success && result.newMeal) {
             const mealToAdd: MealWithItems = {
                ...result.newMeal,
                nutrition_program_meal_items: []
            };
            setMeals(prevMeals => [...prevMeals, mealToAdd]);
        }
     });
   };

   const handleDeleteMeal = (mealId: string, mealName: string) => {
       if (!confirm(`Are you sure you want to delete the meal "${mealName}" and all its items?`)) return;
       startTransition(async () => {
           setActionResult(null);
           const result = await deleteMealAction(mealId);
           setActionResult(result);
           if (result.success) {
               setMeals(prev => prev.filter(m => m.id !== mealId));
           }
       });
   };

   const handleEditItemClick = (item: MealItemWithFood) => {
       setEditingItem(item);
       setActionResult(null);
       setIsEditItemModalOpen(true);
   };

   const handleUpdateItemSubmit = (event: React.FormEvent<HTMLFormElement>) => {
       event.preventDefault();
       if (!editingItem) return;
       const formData = new FormData(event.currentTarget);
       const updateFormData = new FormData();
       updateFormData.append('quantity', formData.get('quantity') as string);
       updateFormData.append('unit', formData.get('unit') as string);
       startTransition(async () => {
           setActionResult(null);
           const result = await updateMealItemAction(editingItem.id, updateFormData);
           setActionResult(result);
           if (result.success) {
               setIsEditItemModalOpen(false);
               setMeals(prevMeals => prevMeals.map(meal => ({
                   ...meal,
                   nutrition_program_meal_items: meal.nutrition_program_meal_items.map(item =>
                       item.id === editingItem.id
                           ? { ...item, quantity: parseFloat(formData.get('quantity') as string), unit: formData.get('unit') as string }
                           : item
                   )
               })));
               setEditingItem(null);
           }
       });
   };

   const handleDeleteItemClick = (itemId: string, mealId: string, itemName: string) => {
       if (!confirm(`Are you sure you want to delete item "${itemName}"?`)) return;
       startTransition(async () => {
           setActionResult(null);
           const result = await deleteMealItemAction(itemId);
           setActionResult(result);
            if (result.success) {
                setMeals(prevMeals => prevMeals.map(meal =>
                    meal.id === mealId
                        ? { ...meal, nutrition_program_meal_items: meal.nutrition_program_meal_items.filter(item => item.id !== itemId) }
                        : meal
                ));
            }
       });
   };

  // --- Render ---
  return (
    <div className="space-y-6">
        {actionResult && (
            <div className={`mb-4 p-3 rounded-md text-sm ${actionResult.success ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-destructive/10 text-destructive border border-destructive/30'}`}>
            {actionResult.message || actionResult.error}
            </div>
        )}

        {/* Week Selector */}
        <div className="mb-6">
            <Label className="block text-sm font-medium text-foreground mb-2">Select Week</Label>
            <RadioGroup
                value={selectedWeek.toString()}
                onValueChange={(value) => setSelectedWeek(parseInt(value, 10))}
                className="flex flex-wrap gap-1" // Use gap-1 for tighter spacing
            >
                {weeks.map((week) => (
                    <div key={`week-selector-${week}`}>
                        <RadioGroupItem value={week.toString()} id={`week-${week}`} className="sr-only" />
                        <Label
                            htmlFor={`week-${week}`}
                            className={cn(
                                "block cursor-pointer rounded-md px-3 py-1.5 text-center text-sm font-medium border", // Base outline style
                                selectedWeek === week
                                    ? "bg-primary text-primary-foreground border-primary" // Selected style
                                    : "border-input bg-background hover:bg-muted/50 text-foreground" // Unselected style (ensure text is visible)
                            )}
                        >
                            Week {week}
                        </Label>
                    </div>
                ))}
            </RadioGroup>
        </div>

        {/* Display Days for Selected Week */}
        {daysInSelectedWeek.length > 0 ? daysInSelectedWeek.map((day) => (
            <div key={`day-${day}`} className="p-4 border rounded-lg bg-card shadow">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">Week {selectedWeek} - Day {day}</h3>
                    {/* Add Day level actions if needed */}
                </div>
                <div className="space-y-4">
                {(mealsByDay[day] || []).map((meal) => (
                    <div key={meal.id} className="p-3 border rounded bg-background">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-medium">{meal.meal_name}</h4>
                            <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive hover:text-destructive h-7 w-7"
                                onClick={() => handleDeleteMeal(meal.id, meal.meal_name)}
                                disabled={isPending}
                                title="Delete Meal"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="pl-2 space-y-2 mb-3"> {/* Added margin-bottom */}
                        {meal.nutrition_program_meal_items.length > 0 ? (
                            meal.nutrition_program_meal_items.map(item => (
                            <div key={item.id} className="flex justify-between items-center text-sm p-2 rounded hover:bg-muted/50">
                                <span>
                                {item.quantity} {item.unit} - {item.foods?.name || 'Unknown Food'}
                                </span>
                                <div className="flex items-center space-x-1">
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    title="Edit Item"
                                    onClick={() => handleEditItemClick(item)}
                                    disabled={isPending}
                                >
                                    <Edit className="h-3 w-3" />
                                </Button>
                                    <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 text-destructive hover:text-destructive"
                                    title="Delete Item"
                                    onClick={() => handleDeleteItemClick(item.id, meal.id, item.foods?.name || 'this item')}
                                    disabled={isPending}
                                    >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                                </div>
                            </div>
                            ))
                        ) : (
                            <p className="text-xs text-muted-foreground italic px-2">No items added yet.</p>
                        )}
                        </div>
                        {/* Add Item Section - Moved to the right */}
                        <div className="mt-3 pt-3 border-t flex justify-end">
                            {addingItemToMealId === meal.id ? (
                                <AddMealItemForm
                                    mealId={meal.id}
                                    programId={program.id}
                                    onCancel={() => setAddingItemToMealId(null)}
                                    onItemAdded={() => {
                                        setAddingItemToMealId(null);
                                        // Optimistic update handled by AddMealItemForm or revalidation
                                    }}
                                    addMealItemAction={addMealItemAction}
                                    importFoodAction={importFoodAction}
                                    mealTemplates={mealTemplates}
                                    addMealTemplateItemsAction={addMealTemplateItemsAction} // Pass the new action prop
                                />
                            ) : (
                                <Button size="sm" variant="outline" onClick={() => setAddingItemToMealId(meal.id)} disabled={isPending}>
                                    <PlusCircle className="mr-1 h-4 w-4" /> Add Item
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
                 {/* Add Meal Button - Moved to the right */}
                 <div className="flex justify-end">
                    <Button onClick={() => handleAddMeal(day)} variant="outline" size="sm" className="mt-2" disabled={isPending}>
                        <PlusCircle className="mr-1 h-4 w-4" /> Add Meal to Day {day}
                    </Button>
                 </div>
                </div>
            </div>
        )) : (
             // Show message if no days exist for the selected week (or initially)
             <div className="text-center py-10 border border-dashed rounded-lg">
                 <h3 className="text-lg font-medium text-muted-foreground">No days added for Week {selectedWeek} yet.</h3>
                 <p className="text-sm text-muted-foreground mt-1 mb-4">Click "Add Day" to start building this week.</p>
             </div>
        )}

        <Button onClick={handleAddDay} variant="secondary" disabled={isPending}>
            <PlusCircle className="mr-1 h-4 w-4" /> Add Day {nextDayNumber}
        </Button>

        {/* Edit Item Modal */}
        <Dialog open={isEditItemModalOpen} onOpenChange={setIsEditItemModalOpen}>
            <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>Edit Meal Item</DialogTitle>
                <DialogDescription>
                Update the quantity and unit for "{editingItem?.foods?.name}".
                </DialogDescription>
            </DialogHeader>
            {editingItem && (
                <form onSubmit={handleUpdateItemSubmit} className="grid gap-4 py-4">
                {actionResult && !actionResult.success && actionResult.error && (
                    <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" /> {actionResult.error}
                    </p>
                )}
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-quantity" className="text-right">Quantity</Label>
                    <Input
                    id="edit-quantity"
                    name="quantity"
                    type="number"
                    step="any"
                    min="0.01"
                    defaultValue={editingItem.quantity}
                    className="col-span-3"
                    required
                    />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-unit" className="text-right">Unit</Label>
                    <Input
                    id="edit-unit"
                    name="unit"
                    defaultValue={editingItem.unit}
                    className="col-span-3"
                    required
                    placeholder="e.g., g, oz, cup"
                    />
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline" disabled={isPending}>Cancel</Button>
                    </DialogClose>
                    <Button type="submit" disabled={isPending}>
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save Changes
                    </Button>
                </DialogFooter>
                </form>
            )}
            </DialogContent>
        </Dialog>
    </div>
  );
}
