'use client';

import React, { useState, useTransition, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Search, AlertCircle, PlusCircle, X } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from '@/lib/supabase/client';
import { Database } from '@/lib/database.types';
// import { logFoodItem } from '@/app/client/actions'; // Action to be created

type FoodItem = Database['public']['Tables']['foods']['Row'];
type ActionResult = { success: boolean; error?: string; message?: string };

interface FoodLogFormProps {
  coachId: string; // Need coachId to search the correct food library
  logFoodAction: (formData: FormData) => Promise<ActionResult>; // Action to be created
}

export function FoodLogForm({ coachId, logFoodAction }: FoodLogFormProps) {
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [quantity, setQuantity] = useState<string>('');
  const [unit, setUnit] = useState<string>('');
  const [logDate, setLogDate] = useState<string>(new Date().toISOString().split('T')[0]); // Default to today
  const [mealName, setMealName] = useState<string>(''); // Optional meal name
  const [notes, setNotes] = useState<string>(''); // Optional notes
  const [formError, setFormError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Debounced search function for coach's food library
  const searchLibraryFoods = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    setFormError(null);
    const { data, error } = await supabase
      .from('foods')
      .select('*') // Select all columns
      .eq('coach_id', coachId) // Filter by coach_id
      .ilike('name', `%${query}%`)
      .limit(10);

    if (error) {
      console.error("Error searching coach's food library:", error);
      setFormError("Error searching food library.");
    } else {
      setSearchResults(data || []);
    }
    setIsSearching(false);
  }, [supabase, coachId]);

  useEffect(() => {
    const handler = setTimeout(() => {
      searchLibraryFoods(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery, searchLibraryFoods]);

  const handleSelectFood = (food: FoodItem) => {
    setSelectedFood(food);
    setSearchQuery('');
    setSearchResults([]);
    setUnit(food.serving_size_unit || 'g'); // Default unit from food item
    setQuantity(food.serving_size_qty?.toString() || '1'); // Default quantity from food item
    setFormError(null);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!selectedFood) return setFormError('Please select a food item.');
    if (!quantity || isNaN(parseFloat(quantity)) || parseFloat(quantity) <= 0) return setFormError('Valid positive quantity required.');
    if (!unit.trim()) return setFormError('Unit is required.');
    if (!logDate) return setFormError('Log date is required.');

    const formData = new FormData();
    formData.append('coachId', coachId); // Pass coachId for the action
    formData.append('foodId', selectedFood.id);
    formData.append('quantity', quantity);
    formData.append('unit', unit.trim());
    formData.append('logDate', logDate);
    if (mealName.trim()) formData.append('mealName', mealName.trim());
    if (notes.trim()) formData.append('notes', notes.trim());

    // Add calculated/estimated nutrition values (using selected food's base values)
    // This is a simplification; ideally, recalculate based on actual quantity/unit vs. serving size
    const scaleFactor = (parseFloat(quantity) || 0) / (selectedFood.serving_size_qty || 1);
    formData.append('calories', ((selectedFood.calories || 0) * scaleFactor).toFixed(0));
    formData.append('protein_g', ((selectedFood.protein_g || 0) * scaleFactor).toFixed(1));
    formData.append('carbs_g', ((selectedFood.carbs_g || 0) * scaleFactor).toFixed(1));
    formData.append('fat_g', ((selectedFood.fat_g || 0) * scaleFactor).toFixed(1));

    startTransition(async () => {
      const result = await logFoodAction(formData);
      if (result.success) {
        // Reset form after successful submission
        setSelectedFood(null);
        setSearchQuery('');
        setQuantity('');
        setUnit('');
        setMealName('');
        setNotes('');
        // Maybe show a success message or navigate away? For now, just reset.
        alert(result.message || 'Food logged successfully!'); // Temporary feedback
      } else {
        setFormError(result.error || 'Failed to log food item.');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {formError && (
        <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md flex items-center gap-1">
          <AlertCircle className="h-4 w-4" /> {formError}
        </p>
      )}

      {/* Date Selection */}
      <div>
        <Label htmlFor="logDate" className="block text-sm font-medium mb-1">Date</Label>
        <Input
          id="logDate"
          name="logDate"
          type="date"
          value={logDate}
          onChange={(e) => setLogDate(e.target.value)}
          required
          className="w-full"
        />
      </div>

       {/* Meal Name (Optional) */}
       <div>
        <Label htmlFor="mealName" className="block text-sm font-medium mb-1">Meal (Optional)</Label>
        <Input
          id="mealName"
          name="mealName"
          type="text"
          value={mealName}
          onChange={(e) => setMealName(e.target.value)}
          placeholder="e.g., Breakfast, Lunch, Snack..."
          className="w-full"
        />
      </div>

      {/* Food Search/Selection */}
      {!selectedFood ? (
        <div className="space-y-2 relative">
          <Label htmlFor="foodSearch">Search Food</Label>
          <div className="flex gap-2 items-center">
            <Input
              id="foodSearch"
              type="text"
              placeholder="Search your coach's food library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-grow"
              required // Require selection before submitting
            />
            {isSearching && <Loader2 className="absolute right-3 top-9 h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          {searchResults.length > 0 && (
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
                    <span className="text-xs text-muted-foreground ml-2">
                      ({food.serving_size_qty} {food.serving_size_unit}, {food.calories} kcal)
                    </span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      ) : (
        <>
          {/* Selected Food Display */}
          <div className="p-3 border rounded bg-background flex justify-between items-center">
            <div>
              <p className="text-sm font-medium">{selectedFood.name}</p>
              <p className="text-xs text-muted-foreground">
                {selectedFood.brand_owner || 'N/A'} | {selectedFood.serving_size_qty} {selectedFood.serving_size_unit} | {selectedFood.calories} kcal
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSelectedFood(null)} title="Change food">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Quantity and Unit */}
          <div className="grid grid-cols-2 gap-4">
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
                placeholder="e.g., 1.5"
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
                placeholder="e.g., serving, g, oz"
              />
            </div>
          </div>
        </>
      )}

      {/* Notes (Optional) */}
      <div>
        <Label htmlFor="notes" className="block text-sm font-medium mb-1">Notes (Optional)</Label>
        <Textarea
          id="notes"
          name="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any additional details..."
          className="w-full"
        />
      </div>

      {/* Submit Button */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending || !selectedFood}>
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
          Log Food Item
        </Button>
      </div>
    </form>
  );
}
