'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"; // Import Collapsible
import { updateFood, deleteFood } from '@/app/coach/actions'; // Import server actions
import { Pencil, Trash2, Loader2, CheckCircle, AlertCircle, ChevronsUpDown, Info } from 'lucide-react'; // Import icons

// Define type for food items (matching the page component)
type FoodItem = {
  id: string;
  name: string;
  brand_owner: string | null;
  serving_size_qty: number;
  serving_size_unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null; // Added missing optional fields
  sugar_g: number | null;
  sodium_mg: number | null;
  source: string;
  full_nutrients?: any; // Added full_nutrients
};

// Re-define UsdaNutrient type here for use in the component
interface UsdaNutrient {
  nutrient: {
    id: number;
    number: string;
    name: string;
    rank: number;
    unitName: string;
  };
  type: string;
  amount?: number;
  id?: number;
  foodNutrientDerivation?: any; // Simplified for frontend use
}

// Define props for the client component
interface FoodListTableProps {
  foods: FoodItem[];
  // Pass server actions as props
  updateFoodAction: typeof updateFood;
  deleteFoodAction: typeof deleteFood;
}

// Define type for action results (matching actions.ts)
type ActionResult = { success: boolean; error?: string; message?: string };

export function FoodListTable({ foods, updateFoodAction, deleteFoodAction }: FoodListTableProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingFood, setEditingFood] = useState<FoodItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [actionResult, setActionResult] = useState<ActionResult | null>(null);
  const [openCollapsibleId, setOpenCollapsibleId] = useState<string | null>(null); // Track open collapsible

  const handleEditClick = (food: FoodItem) => {
    setEditingFood(food);
    setActionResult(null); // Clear previous results
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (foodId: string) => {
    setDeleteConfirmId(foodId);
    setActionResult(null); // Clear previous results
  };

  const handleConfirmDelete = (foodId: string) => {
    startTransition(async () => {
      const result = await deleteFoodAction(foodId);
      setActionResult(result);
      if (result.success) {
        setDeleteConfirmId(null); // Close confirmation on success
        // Revalidation is handled by the server action
      }
    });
  };

  const handleEditSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingFood) return;

    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateFoodAction(editingFood.id, formData);
      setActionResult(result);
      if (result.success) {
        setIsEditModalOpen(false); // Close modal on success
        setEditingFood(null);
        // Revalidation is handled by the server action
      }
      // Keep modal open on error to show message
    });
  };

  return (
    <>
      {actionResult && !actionResult.success && (
        <div className={`mb-4 p-3 rounded-md text-sm ${actionResult.error ? 'bg-destructive/10 text-destructive border border-destructive/30' : 'bg-muted text-muted-foreground'}`}>
          <div className="flex items-center gap-2">
             <AlertCircle className="h-4 w-4" />
             <span>{actionResult.error || 'An unexpected error occurred.'}</span>
          </div>
        </div>
      )}
       {actionResult && actionResult.success && actionResult.message && (
        <div className="mb-4 p-3 rounded-md text-sm bg-green-100 text-green-800 border border-green-200">
           <div className="flex items-center gap-2">
             <CheckCircle className="h-4 w-4" />
             <span>{actionResult.message}</span>
           </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground sm:px-6">Name</th>
              <th scope="col" className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground md:table-cell">Brand</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Serving</th>
              <th scope="col" className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground sm:table-cell">Calories</th>
              <th scope="col" className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground sm:table-cell">Protein</th>
              <th scope="col" className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground lg:table-cell">Carbs</th>
              <th scope="col" className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground lg:table-cell">Fat</th>
              <th scope="col" className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground md:table-cell">Source</th>
              <th scope="col" className="relative px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground sm:px-6">Details</th>
              <th scope="col" className="relative px-4 py-3 sm:px-6"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {foods.map((food) => (
             <Collapsible key={food.id} asChild open={openCollapsibleId === food.id} onOpenChange={(isOpen) => setOpenCollapsibleId(isOpen ? food.id : null)}>
              <>
               {/* Main data row */}
               <tr>
                 <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-foreground sm:px-6">{food.name}</td>
                 <td className="hidden whitespace-nowrap px-4 py-4 text-sm text-muted-foreground md:table-cell">{food.brand_owner || '-'}</td>
                 <td className="whitespace-nowrap px-4 py-4 text-sm text-muted-foreground">{food.serving_size_qty} {food.serving_size_unit}</td>
                 <td className="hidden whitespace-nowrap px-4 py-4 text-sm text-muted-foreground sm:table-cell">{food.calories}</td>
                 <td className="hidden whitespace-nowrap px-4 py-4 text-sm text-muted-foreground sm:table-cell">{food.protein_g}g</td>
                 <td className="hidden whitespace-nowrap px-4 py-4 text-sm text-muted-foreground lg:table-cell">{food.carbs_g}g</td>
                 <td className="hidden whitespace-nowrap px-4 py-4 text-sm text-muted-foreground lg:table-cell">{food.fat_g}g</td>
                 <td className="hidden whitespace-nowrap px-4 py-4 text-sm text-muted-foreground md:table-cell capitalize">{food.source}</td>
                 {/* Details Trigger */}
                 <td className="whitespace-nowrap px-4 py-4 text-center text-sm font-medium sm:px-6">
                    {food.full_nutrients && Array.isArray(food.full_nutrients) && food.full_nutrients.length > 0 ? (
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon" title="Show/Hide Details">
                          <ChevronsUpDown className={`h-4 w-4 ${openCollapsibleId === food.id ? 'text-primary' : ''}`} />
                          <span className="sr-only">Toggle Details</span>
                        </Button>
                      </CollapsibleTrigger>
                    ) : (
                       <Button variant="ghost" size="icon" disabled title="No detailed data available">
                          <Info className="h-4 w-4 text-muted-foreground/50" />
                          <span className="sr-only">No Details</span>
                       </Button>
                    )}
                 </td>
                 {/* Actions Column */}
                 <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-medium sm:px-6">
                  {deleteConfirmId === food.id ? (
                    <div className="flex items-center justify-end space-x-2">
                       <span className="text-xs text-destructive">Delete?</span>
                       <Button
                         variant="destructive"
                         size="sm"
                         onClick={() => handleConfirmDelete(food.id)}
                         disabled={isPending}
                       >
                         {isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                         Confirm
                       </Button>
                       <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(null)} disabled={isPending}>Cancel</Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditClick(food)}
                        disabled={isPending || food.source !== 'manual'} // Only allow editing manual entries
                        title={food.source !== 'manual' ? "Cannot edit non-manual entries" : "Edit Food"}
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteClick(food.id)}
                        disabled={isPending || food.source !== 'manual'} // Only allow deleting manual entries
                         title={food.source !== 'manual' ? "Cannot delete non-manual entries" : "Delete Food"}
                      >
                        <Trash2 className="h-4 w-4" />
                         <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  )}
                 </td>
               </tr>
               {/* Collapsible Details Row */}
               <CollapsibleContent asChild>
                 <tr>
                   <td colSpan={10} className="p-0"> {/* Adjust colSpan based on the final number of columns */}
                     <div className="bg-muted/30 p-4">
                       <h4 className="mb-2 text-sm font-semibold">Full Nutrient Details (per {food.serving_size_qty}{food.serving_size_unit}):</h4>
                       {food.full_nutrients && Array.isArray(food.full_nutrients) && food.full_nutrients.length > 0 ? (
                         <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3 md:grid-cols-4">
                           {food.full_nutrients
                             .filter((n: UsdaNutrient) => n.amount !== undefined && n.amount !== null) // Only show nutrients with an amount
                             .sort((a: UsdaNutrient, b: UsdaNutrient) => (a.nutrient.rank || 9999) - (b.nutrient.rank || 9999)) // Sort by rank
                             .map((nutrient: UsdaNutrient) => (
                               <li key={nutrient.nutrient.id || nutrient.nutrient.number} className="flex justify-between">
                                 <span className="text-muted-foreground">{nutrient.nutrient.name}:</span>
                                 <span className="font-medium">
                                   {/* Format amount - avoid excessive decimals */}
                                   {nutrient.amount! % 1 === 0 ? nutrient.amount : nutrient.amount!.toFixed(2)}
                                   {nutrient.nutrient.unitName?.toLowerCase()}
                                 </span>
                               </li>
                           ))}
                         </ul>
                       ) : (
                         <p className="text-xs text-muted-foreground">No detailed nutrient data available for this item.</p>
                       )}
                     </div>
                   </td>
                 </tr>
               </CollapsibleContent>
              </>
             </Collapsible>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Food Item</DialogTitle>
            <DialogDescription>
              Update the details for "{editingFood?.name}". Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          {editingFood && (
            <form onSubmit={handleEditSubmit} className="grid gap-4 py-4">
               {actionResult && !actionResult.success && actionResult.error && (
                 <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" /> {actionResult.error}
                 </p>
               )}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Name</Label>
                <Input id="name" name="name" defaultValue={editingFood.name} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="brand_owner" className="text-right">Brand</Label>
                <Input id="brand_owner" name="brand_owner" defaultValue={editingFood.brand_owner || ''} className="col-span-3" placeholder="Optional" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                 <Label htmlFor="serving_size_qty" className="text-right">Serving Size</Label>
                 <div className="col-span-3 grid grid-cols-2 gap-2">
                    <Input id="serving_size_qty" name="serving_size_qty" type="number" step="any" min="0.01" defaultValue={editingFood.serving_size_qty} required />
                    <Input id="serving_size_unit" name="serving_size_unit" defaultValue={editingFood.serving_size_unit} placeholder="e.g., g, oz, cup" required />
                 </div>
              </div>
               <div className="grid grid-cols-4 items-center gap-4">
                 <Label htmlFor="calories" className="text-right">Calories</Label>
                 <Input id="calories" name="calories" type="number" step="any" min="0" defaultValue={editingFood.calories} className="col-span-3" required />
               </div>
               <div className="grid grid-cols-4 items-center gap-4">
                 <Label htmlFor="protein_g" className="text-right">Protein (g)</Label>
                 <Input id="protein_g" name="protein_g" type="number" step="any" min="0" defaultValue={editingFood.protein_g} className="col-span-3" required />
               </div>
               <div className="grid grid-cols-4 items-center gap-4">
                 <Label htmlFor="carbs_g" className="text-right">Carbs (g)</Label>
                 <Input id="carbs_g" name="carbs_g" type="number" step="any" min="0" defaultValue={editingFood.carbs_g} className="col-span-3" required />
               </div>
               <div className="grid grid-cols-4 items-center gap-4">
                 <Label htmlFor="fat_g" className="text-right">Fat (g)</Label>
                 <Input id="fat_g" name="fat_g" type="number" step="any" min="0" defaultValue={editingFood.fat_g} className="col-span-3" required />
               </div>
               {/* Optional Fields */}
               <div className="grid grid-cols-4 items-center gap-4">
                 <Label htmlFor="fiber_g" className="text-right">Fiber (g)</Label>
                 <Input id="fiber_g" name="fiber_g" type="number" step="any" min="0" defaultValue={editingFood.fiber_g ?? ''} className="col-span-3" placeholder="Optional" />
               </div>
               <div className="grid grid-cols-4 items-center gap-4">
                 <Label htmlFor="sugar_g" className="text-right">Sugar (g)</Label>
                 <Input id="sugar_g" name="sugar_g" type="number" step="any" min="0" defaultValue={editingFood.sugar_g ?? ''} className="col-span-3" placeholder="Optional" />
               </div>
               <div className="grid grid-cols-4 items-center gap-4">
                 <Label htmlFor="sodium_mg" className="text-right">Sodium (mg)</Label>
                 <Input id="sodium_mg" name="sodium_mg" type="number" step="any" min="0" defaultValue={editingFood.sodium_mg ?? ''} className="col-span-3" placeholder="Optional" />
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
    </>
  );
}
