'use client';

import React, { useState, useTransition, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { UsdaImportDialog } from '@/app/coach/nutrition/foods/UsdaImportDialog';
import {
    addNutritionProgramMealItem,
    importUsdaFood,
    addManualFood,
    addMealTemplateItemsToProgram // Import the new action
} from '@/app/coach/actions';
import { Loader2, Search, AlertCircle, CheckCircle, PlusCircle, X, ChevronsUpDown, Trash2 } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from '@/lib/supabase/client';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { Database } from '@/lib/database.types'; // Ensure Database type is imported

// Type aliases
type LibraryFood = Database['public']['Tables']['foods']['Row'];
type MealTemplate = Database['public']['Tables']['meals']['Row']; // Type for saved meal templates

// Define type for action results
type ActionResult = { success: boolean; error?: string; message?: string; data?: any };

interface AddMealItemFormProps {
  mealId: string; // This is the nutrition_program_meals.id (target meal block)
  programId: string;
  onCancel: () => void;
  onItemAdded: () => void; // Callback after any item/meal is added
  addMealItemAction: typeof addNutritionProgramMealItem; // Action for adding single food
  importFoodAction: typeof importUsdaFood;
  mealTemplates: MealTemplate[]; // Prop for saved meal templates
  addMealTemplateItemsAction: typeof addMealTemplateItemsToProgram; // Action for adding meal template items
}

// Define optional nutrients for the dropdown
const optionalNutrientList = [
  "Vitamin A", "Vitamin C", "Vitamin E", "Vitamin K", "Thiamin", "Riboflavin",
  "Niacin", "Vitamin B6", "Folate", "Vitamin B12", "Biotin", "Pantothenic Acid",
  "Phosphorus", "Iodine", "Magnesium", "Zinc", "Selenium", "Copper",
  "Manganese", "Chromium", "Molybdenum", "Chloride"
];

// Type for optional nutrient state
type OptionalNutrient = {
    id: string; // For unique key in list rendering
    name: string;
    amount: string;
    unit: string;
};

export function AddMealItemForm({
  mealId,
  programId,
  onCancel,
  onItemAdded,
  addMealItemAction,
  importFoodAction,
  mealTemplates,
  addMealTemplateItemsAction // Destructure new action prop
}: AddMealItemFormProps) {
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();
  const [inputType, setInputType] = useState<'food' | 'meal'>('food'); // State for selection
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LibraryFood[]>([]);
  const [selectedFood, setSelectedFood] = useState<LibraryFood | null>(null);
  const [quantity, setQuantity] = useState<string>('');
  const [unit, setUnit] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null); // General form error
  const [isSearching, setIsSearching] = useState(false); // For food search
  const [isManualAddOpen, setIsManualAddOpen] = useState(false); // For manual food add collapsible

  // State for meal template selection
  const [selectedMealTemplateId, setSelectedMealTemplateId] = useState<string>('');

  // State for manual entry form
  const [manualName, setManualName] = useState('');
  const [manualBrand, setManualBrand] = useState('');
  const [manualServingQty, setManualServingQty] = useState('');
  const [manualServingUnit, setManualServingUnit] = useState('');
  const [manualCalories, setManualCalories] = useState('');
  const [manualTotalFat, setManualTotalFat] = useState('');
  const [manualSatFat, setManualSatFat] = useState('');
  const [manualTransFat, setManualTransFat] = useState('');
  const [manualCholesterol, setManualCholesterol] = useState('');
  const [manualSodium, setManualSodium] = useState('');
  const [manualTotalCarbs, setManualTotalCarbs] = useState('');
  const [manualFiber, setManualFiber] = useState('');
  const [manualTotalSugars, setManualTotalSugars] = useState('');
  const [manualAddedSugars, setManualAddedSugars] = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const [manualVitD, setManualVitD] = useState('');
  const [manualCalcium, setManualCalcium] = useState('');
  const [manualIron, setManualIron] = useState('');
  const [manualPotassium, setManualPotassium] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [manualFormError, setManualFormError] = useState<string | null>(null);

  // State for optional nutrients
  const [optionalNutrients, setOptionalNutrients] = useState<OptionalNutrient[]>([]);
  const [currentOptionalNutrient, setCurrentOptionalNutrient] = useState('');
  const [currentOptionalAmount, setCurrentOptionalAmount] = useState('');
  const [currentOptionalUnit, setCurrentOptionalUnit] = useState('');


  // Debounced search function (remains the same)
  const searchLibraryFoods = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    setFormError(null);
    const { data, error } = await supabase
      .from('foods')
      .select('*') // Select all columns to match LibraryFood type
      .ilike('name', `%${query}%`)
      .limit(10);

    if (error) {
      console.error("Error searching library foods:", error);
      setFormError("Error searching food library.");
    } else {
      setSearchResults(data || []);
    }
    setIsSearching(false);
  }, [supabase]);

  useEffect(() => {
    const handler = setTimeout(() => {
      searchLibraryFoods(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery, searchLibraryFoods]);

  const handleSelectFood = (food: LibraryFood) => {
    setSelectedFood(food);
    setSearchQuery('');
    setSearchResults([]);
    setUnit(food.serving_size_unit || 'g');
    setQuantity(food.serving_size_qty?.toString() || '1');
    setFormError(null);
  };

  // Handles submitting the selected *food* item
  const handleFoodItemSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    if (!selectedFood) return setFormError('Please select a food item.');
    if (!quantity || isNaN(parseFloat(quantity)) || parseFloat(quantity) <= 0) return setFormError('Valid positive quantity required.');
    if (!unit.trim()) return setFormError('Unit is required.');

    const formData = new FormData();
    formData.append('mealId', mealId);
    formData.append('foodId', selectedFood.id);
    formData.append('quantity', quantity);
    formData.append('unit', unit.trim());

    startTransition(async () => {
      const result = await addMealItemAction(formData);
      if (result.success) {
        onItemAdded();
        onCancel();
      } else {
        setFormError(result.error || 'Failed to add item.');
      }
    });
  };

  // Handles submitting the selected *meal template*
  const handleMealTemplateSubmit = (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setFormError(null);
      if (!selectedMealTemplateId) {
          return setFormError('Please select a meal template.');
      }

      startTransition(async () => {
          const result = await addMealTemplateItemsAction(selectedMealTemplateId, mealId);
          if (result.success) {
              onItemAdded(); // Trigger refresh/update in parent
              onCancel(); // Close the form
          } else {
              setFormError(result.error || 'Failed to add items from meal template.');
          }
      });
  };


  // Handles adding an optional nutrient to the list
  const handleAddOptionalNutrient = () => {
      if (!currentOptionalNutrient || !currentOptionalAmount || !currentOptionalUnit) {
          // Basic validation
          alert("Please select a nutrient and enter its amount and unit.");
          return;
      }
      if (isNaN(parseFloat(currentOptionalAmount)) || parseFloat(currentOptionalAmount) < 0) {
          alert("Please enter a valid non-negative amount.");
          return;
      }
      setOptionalNutrients(prev => [
          ...prev,
          {
              id: crypto.randomUUID(), // Simple unique ID for list key
              name: currentOptionalNutrient,
              amount: currentOptionalAmount,
              unit: currentOptionalUnit
          }
      ]);
      // Reset adder form
      setCurrentOptionalNutrient('');
      setCurrentOptionalAmount('');
      setCurrentOptionalUnit('');
  };

  // Handles removing an optional nutrient
  const handleRemoveOptionalNutrient = (idToRemove: string) => {
      setOptionalNutrients(prev => prev.filter(n => n.id !== idToRemove));
  };


  // Handles submitting the manually created food
  const handleManualSubmit = (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setManualFormError(null);

      // Basic validation for required fields
      if (!manualName.trim()) return setManualFormError('Item name is required.');
      if (!manualServingQty || isNaN(parseFloat(manualServingQty)) || parseFloat(manualServingQty) <= 0) return setManualFormError('Valid positive serving size quantity required.');
      if (!manualServingUnit.trim()) return setManualFormError('Serving size unit is required.');
      if (!manualCalories || isNaN(parseFloat(manualCalories)) || parseFloat(manualCalories) < 0) return setManualFormError('Valid non-negative calories required.');
      if (!manualProtein || isNaN(parseFloat(manualProtein)) || parseFloat(manualProtein) < 0) return setManualFormError('Valid non-negative protein required.');
      if (!manualTotalCarbs || isNaN(parseFloat(manualTotalCarbs)) || parseFloat(manualTotalCarbs) < 0) return setManualFormError('Valid non-negative total carbs required.');
      if (!manualTotalFat || isNaN(parseFloat(manualTotalFat)) || parseFloat(manualTotalFat) < 0) return setManualFormError('Valid non-negative total fat required.');
      // Add validation for other mandatory fields if needed

      const manualFoodData = new FormData();
      manualFoodData.append('name', manualName.trim());
      manualFoodData.append('brand_owner', manualBrand.trim() || ''); // Use empty string for null
      manualFoodData.append('serving_size_qty', manualServingQty);
      manualFoodData.append('serving_size_unit', manualServingUnit.trim());
      manualFoodData.append('calories', manualCalories);
      manualFoodData.append('protein_g', manualProtein);
      manualFoodData.append('total_carbohydrate_g', manualTotalCarbs);
      manualFoodData.append('total_fat_g', manualTotalFat);
      manualFoodData.append('saturated_fat_g', manualSatFat || ''); // Use empty string for null
      manualFoodData.append('trans_fat_g', manualTransFat || ''); // Use empty string for null
      manualFoodData.append('cholesterol_mg', manualCholesterol || ''); // Use empty string for null
      manualFoodData.append('sodium_mg', manualSodium || ''); // Use empty string for null
      manualFoodData.append('dietary_fiber_g', manualFiber || ''); // Use empty string for null
      manualFoodData.append('total_sugars_g', manualTotalSugars || ''); // Use empty string for null
      manualFoodData.append('added_sugars_g', manualAddedSugars || ''); // Use empty string for null
      manualFoodData.append('vitamin_d_mcg', manualVitD || ''); // Use empty string for null
      manualFoodData.append('calcium_mg', manualCalcium || ''); // Use empty string for null
      manualFoodData.append('iron_mg', manualIron || ''); // Use empty string for null
      manualFoodData.append('potassium_mg', manualPotassium || ''); // Use empty string for null
      manualFoodData.append('optional_nutrients_json', JSON.stringify(optionalNutrients));

      startTransition(async () => {
          const addFoodResult = await addManualFood(manualFoodData);
          if (!addFoodResult.success || !addFoodResult.data?.newFoodId) {
              setManualFormError(addFoodResult.error || 'Failed to create manual food item.');
              return;
          }

          const addItemFormData = new FormData();
          addItemFormData.append('mealId', mealId);
          addItemFormData.append('foodId', addFoodResult.data.newFoodId);
          // Use the serving size as the default quantity/unit when adding the item
          addItemFormData.append('quantity', manualServingQty);
          addItemFormData.append('unit', manualServingUnit.trim());

          const addItemResult = await addMealItemAction(addItemFormData);
          if (addItemResult.success) {
              onItemAdded();
              onCancel();
          } else {
              setManualFormError(addItemResult.error || 'Failed to add created item to meal.');
          }
      });
  };

  const handleUsdaImportSuccess = () => {
      alert("USDA food added to your library. Please search for it now to add it to the meal.");
  };

  return (
    // Main container - remove form tag, ensure full width
    <div className="space-y-4 p-4 border rounded-md bg-muted/20 w-full">
       {/* Input Type Selection */}
       <RadioGroup defaultValue="food" onValueChange={(value: 'food' | 'meal') => setInputType(value)} className="flex gap-4 mb-4">
           <div className="flex items-center space-x-2">
               <RadioGroupItem value="food" id="type-food" />
               <Label htmlFor="type-food" className="text-sm font-medium">Add Individual Food</Label>
           </div>
           <div className="flex items-center space-x-2">
               <RadioGroupItem value="meal" id="type-meal" />
               <Label htmlFor="type-meal" className="text-sm font-medium">Add Saved Meal</Label>
           </div>
       </RadioGroup>

       {formError && (
         <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md flex items-center gap-1">
            <AlertCircle className="h-4 w-4" /> {formError}
         </p>
       )}

       {/* Conditional UI based on inputType */}
       {inputType === 'food' && (
         <>
           {/* Section 1: Search/Select/Import Food */}
           <form onSubmit={handleFoodItemSubmit} className="space-y-4 pb-4 border-b">
             <h4 className="font-medium text-sm text-muted-foreground">Add Individual Food from Library / USDA</h4>
             {!selectedFood ? (
               <div className="space-y-2 relative">
                 <Label htmlFor="foodSearch">Search Food Library or Add from USDA</Label>
                 <div className="flex gap-2 items-center">
                    <Input
                      id="foodSearch"
                      type="text"
                      placeholder="Search your food library..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-grow"
                    />
                    <UsdaImportDialog importFoodAction={importFoodAction} /* onImportSuccess={handleUsdaImportSuccess} */ />
                 </div>
                 {isSearching && <Loader2 className="absolute right-12 top-9 h-4 w-4 animate-spin text-muted-foreground" />}
                 {searchResults.length > 0 && (
                   <>
                     <ScrollArea className="h-[150px] w-full rounded-md border bg-background p-2 mt-1">
                       <div className="space-y-1">
                         {searchResults.map((food) => (
                           <button
                             key={food.id}
                             type="button"
                             onClick={() => handleSelectFood(food)}
                             className="block w-full text-left p-2 rounded hover:bg-muted text-sm"
                           >
                             {food.name} {food.brand_owner ? `(${food.brand_owner})` : ''}
                             <span className="text-xs text-muted-foreground ml-2">({food.source})</span>
                           </button>
                         ))}
                       </div>
                     </ScrollArea>
                   </>
                 )}
               </div>
             ) : (
               <>
                 <div className="p-2 border rounded bg-background flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">{selectedFood.name}</p>
                      <p className="text-xs text-muted-foreground">
                         {selectedFood.brand_owner || 'N/A'} | {selectedFood.serving_size_qty} {selectedFood.serving_size_unit} | Src: {selectedFood.source}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedFood(null)} title="Change food">
                       <X className="h-4 w-4" />
                    </Button>
                 </div>
                 {/* Quantity, Unit, and Add Button */}
                 <div className="grid grid-cols-3 gap-3 items-end">
                   <div>
                     <Label htmlFor="quantity">Quantity</Label>
                     <Input
                       id="quantity"
                       name="quantity"
                       type="number"
                       step="any"
                       min="0.01"
                       value={quantity}
                       onChange={(e) => setQuantity(e.target.value)}
                       required
                       placeholder="e.g., 150"
                     />
                   </div>
                   <div>
                     <Label htmlFor="unit">Unit</Label>
                     <Input
                       id="unit"
                       name="unit"
                       type="text"
                       value={unit}
                       onChange={(e) => setUnit(e.target.value)}
                       required
                       placeholder="e.g., g, oz, cup"
                     />
                   </div>
                   <Button type="submit" disabled={isPending || !selectedFood} className="col-span-3 sm:col-span-1">
                     {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                     Add Selected Item
                   </Button>
                 </div>
               </>
             )}
           </form>

           {/* Section 2: Manual Food Add (Collapsible) */}
           <Collapsible open={isManualAddOpen} onOpenChange={setIsManualAddOpen} className="pt-4">
             <CollapsibleTrigger asChild>
                 <Button variant="ghost" className="w-full justify-start p-2 text-sm">
                     <ChevronsUpDown className="h-4 w-4 mr-2" />
                     Manually Add New Food Item
                 </Button>
             </CollapsibleTrigger>
             <CollapsibleContent>
                 <form onSubmit={handleManualSubmit} className="space-y-4 p-4 border-t">
                      <h4 className="font-medium text-sm text-muted-foreground">Enter Nutrition Details</h4>
                      {manualFormError && (
                          <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md flex items-center gap-1">
                             <AlertCircle className="h-4 w-4" /> {manualFormError}
                          </p>
                      )}
                     {/* Basic Info */}
                     <div className="grid grid-cols-2 gap-4">
                         <div>
                             <Label htmlFor="manualName">Item Name *</Label>
                             <Input id="manualName" value={manualName} onChange={(e) => setManualName(e.target.value)} required />
                         </div>
                         <div>
                             <Label htmlFor="manualBrand">Brand (Optional)</Label>
                             <Input id="manualBrand" value={manualBrand} onChange={(e) => setManualBrand(e.target.value)} />
                         </div>
                     </div>
                     {/* Serving Size */}
                     <div className="grid grid-cols-2 gap-4">
                         <div>
                             <Label htmlFor="manualServingQty">Serving Qty *</Label>
                             <Input id="manualServingQty" type="number" step="any" min="0.01" value={manualServingQty} onChange={(e) => setManualServingQty(e.target.value)} required />
                         </div>
                         <div>
                             <Label htmlFor="manualServingUnit">Serving Unit *</Label>
                             <Input id="manualServingUnit" value={manualServingUnit} onChange={(e) => setManualServingUnit(e.target.value)} required placeholder="g, oz, cup..." />
                         </div>
                     </div>
                     {/* Macros */}
                     <div className="grid grid-cols-3 gap-4">
                         <div><Label htmlFor="manualCalories">Calories *</Label><Input id="manualCalories" type="number" min="0" step="any" value={manualCalories} onChange={(e) => setManualCalories(e.target.value)} required /></div>
                         <div><Label htmlFor="manualProtein">Protein (g) *</Label><Input id="manualProtein" type="number" min="0" step="any" value={manualProtein} onChange={(e) => setManualProtein(e.target.value)} required /></div>
                         <div><Label htmlFor="manualTotalFat">Total Fat (g) *</Label><Input id="manualTotalFat" type="number" min="0" step="any" value={manualTotalFat} onChange={(e) => setManualTotalFat(e.target.value)} required /></div>
                         <div><Label htmlFor="manualSatFat">Saturated Fat (g)</Label><Input id="manualSatFat" type="number" min="0" step="any" value={manualSatFat} onChange={(e) => setManualSatFat(e.target.value)} /></div>
                         <div><Label htmlFor="manualTransFat">Trans Fat (g)</Label><Input id="manualTransFat" type="number" min="0" step="any" value={manualTransFat} onChange={(e) => setManualTransFat(e.target.value)} /></div>
                         <div><Label htmlFor="manualCholesterol">Cholesterol (mg)</Label><Input id="manualCholesterol" type="number" min="0" step="any" value={manualCholesterol} onChange={(e) => setManualCholesterol(e.target.value)} /></div>
                         <div><Label htmlFor="manualSodium">Sodium (mg)</Label><Input id="manualSodium" type="number" min="0" step="any" value={manualSodium} onChange={(e) => setManualSodium(e.target.value)} /></div>
                         <div><Label htmlFor="manualTotalCarbs">Total Carbs (g) *</Label><Input id="manualTotalCarbs" type="number" min="0" step="any" value={manualTotalCarbs} onChange={(e) => setManualTotalCarbs(e.target.value)} required /></div>
                         <div><Label htmlFor="manualFiber">Dietary Fiber (g)</Label><Input id="manualFiber" type="number" min="0" step="any" value={manualFiber} onChange={(e) => setManualFiber(e.target.value)} /></div>
                         <div><Label htmlFor="manualTotalSugars">Total Sugars (g)</Label><Input id="manualTotalSugars" type="number" min="0" step="any" value={manualTotalSugars} onChange={(e) => setManualTotalSugars(e.target.value)} /></div>
                         <div><Label htmlFor="manualAddedSugars">Added Sugars (g)</Label><Input id="manualAddedSugars" type="number" min="0" step="any" value={manualAddedSugars} onChange={(e) => setManualAddedSugars(e.target.value)} /></div>
                     </div>
                      {/* Mandatory Micros */}
                      <div className="grid grid-cols-4 gap-4">
                          <div><Label htmlFor="manualVitD">Vitamin D (mcg)</Label><Input id="manualVitD" type="number" min="0" step="any" value={manualVitD} onChange={(e) => setManualVitD(e.target.value)} /></div>
                          <div><Label htmlFor="manualCalcium">Calcium (mg)</Label><Input id="manualCalcium" type="number" min="0" step="any" value={manualCalcium} onChange={(e) => setManualCalcium(e.target.value)} /></div>
                          <div><Label htmlFor="manualIron">Iron (mg)</Label><Input id="manualIron" type="number" min="0" step="any" value={manualIron} onChange={(e) => setManualIron(e.target.value)} /></div>
                          <div><Label htmlFor="manualPotassium">Potassium (mg)</Label><Input id="manualPotassium" type="number" min="0" step="any" value={manualPotassium} onChange={(e) => setManualPotassium(e.target.value)} /></div>
                      </div>

                      {/* Optional Nutrients Adder */}
                      <Collapsible className="pt-4 border-t">
                          <CollapsibleTrigger asChild>
                              <Button variant="link" type="button" className="p-0 h-auto text-sm">
                                  <PlusCircle className="h-4 w-4 mr-1" /> Add Other Vitamin/Mineral
                              </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-2 space-y-3">
                              {/* Display added optional nutrients */}
                              {optionalNutrients.length > 0 && (
                                  <div className="space-y-1 text-xs border p-2 rounded-md">
                                      <Label className="text-xs font-medium">Added Optional Nutrients:</Label>
                                      {optionalNutrients.map(n => (
                                          <div key={n.id} className="flex justify-between items-center">
                                              <span>{n.name}: {n.amount} {n.unit}</span>
                                              <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleRemoveOptionalNutrient(n.id)}>
                                                  <Trash2 className="h-3 w-3 text-destructive" />
                                              </Button>
                                          </div>
                                      ))}
                                  </div>
                              )}
                              {/* Form to add a new optional nutrient */}
                              <div className="flex items-end gap-2">
                                  <div className="flex-1">
                                      <Label htmlFor="optionalNutrientName" className="text-xs">Nutrient Name</Label>
                                      <Select value={currentOptionalNutrient} onValueChange={setCurrentOptionalNutrient}>
                                          <SelectTrigger id="optionalNutrientName"><SelectValue placeholder="Select..." /></SelectTrigger>
                                          <SelectContent>
                                              {optionalNutrientList.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                                          </SelectContent>
                                      </Select>
                                  </div>
                                  <div className="w-20">
                                      <Label htmlFor="optionalNutrientAmount" className="text-xs">Amount</Label>
                                      <Input id="optionalNutrientAmount" type="number" step="any" min="0" value={currentOptionalAmount} onChange={(e) => setCurrentOptionalAmount(e.target.value)} placeholder="Amt" />
                                  </div>
                                  <div className="w-20">
                                      <Label htmlFor="optionalNutrientUnit" className="text-xs">Unit</Label>
                                      <Input id="optionalNutrientUnit" value={currentOptionalUnit} onChange={(e) => setCurrentOptionalUnit(e.target.value)} placeholder="mg, mcg..." />
                                  </div>
                                  <Button type="button" size="sm" variant="secondary" onClick={handleAddOptionalNutrient}>Add</Button>
                              </div>
                          </CollapsibleContent>
                      </Collapsible>

                     <div>
                         <Label htmlFor="manualNotes">Notes (Optional)</Label>
                         <Textarea id="manualNotes" value={manualNotes} onChange={(e) => setManualNotes(e.target.value)} />
                     </div>
                     <div className="flex justify-end gap-2">
                          <Button type="button" variant="ghost" onClick={() => setIsManualAddOpen(false)} disabled={isPending}>Cancel Manual Add</Button>
                          <Button type="submit" disabled={isPending}>
                             {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                             Save & Add Manual Item
                          </Button>
                     </div>
                 </form>
             </CollapsibleContent>
           </Collapsible>
         </>
       )}

       {inputType === 'meal' && (
         <form onSubmit={handleMealTemplateSubmit} className="space-y-4 pb-4 border-b">
            <h4 className="font-medium text-sm text-muted-foreground">Add Saved Meal Template</h4>
            <div>
                <Label htmlFor="mealTemplateSelect">Select Meal Template</Label>
                <Select name="mealTemplateId" value={selectedMealTemplateId} onValueChange={setSelectedMealTemplateId} required>
                    <SelectTrigger id="mealTemplateSelect">
                        <SelectValue placeholder="Select a saved meal..." />
                    </SelectTrigger>
                    <SelectContent>
                        {mealTemplates.length === 0 ? (
                            <SelectItem value="-" disabled>No saved meal templates found</SelectItem>
                        ) : (
                            mealTemplates.map((template) => (
                                <SelectItem key={template.id} value={template.id}>
                                    {template.name}
                                </SelectItem>
                            ))
                        )}
                    </SelectContent>
                </Select>
            </div>
            <Button type="submit" disabled={isPending || !selectedMealTemplateId || mealTemplates.length === 0} className="w-full">
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                Add Saved Meal Items
            </Button>
         </form>
       )}


      {/* Global Cancel Button */}
      <div className="pt-4 border-t flex justify-start">
         <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
             Cancel
         </Button>
      </div>

    </div>
  );
}
