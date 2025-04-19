'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Database } from '@/lib/database.types';
import { addMealItemToTemplate } from '@/app/coach/actions'; // Action to be created
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';

type Food = Database['public']['Tables']['foods']['Row'];
type ActionResult = { success: boolean; error?: string; message?: string };

interface AddMealItemFormProps {
  mealId: string;
  foodLibrary: Food[];
}

export function AddMealItemForm({ mealId, foodLibrary }: AddMealItemFormProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedFoodId, setSelectedFoodId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1'); // Default quantity
  const [actionResult, setActionResult] = useState<ActionResult | null>(null);
  const [formKey, setFormKey] = useState(Date.now()); // To reset form state on success

  const selectedFood = foodLibrary.find(f => f.id === selectedFoodId);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFoodId || !quantity) {
        setActionResult({ success: false, error: 'Please select a food and enter a quantity.' });
        return;
    }

    const formData = new FormData(event.currentTarget);
    formData.set('mealId', mealId); // Ensure mealId is included

    setActionResult(null); // Clear previous results
    startTransition(async () => {
      const result = await addMealItemToTemplate(formData);
      setActionResult(result);
      if (result.success) {
        // Reset form fields on success
        setSelectedFoodId('');
        setQuantity('1');
        setFormKey(Date.now()); // Change key to force re-render of Select
      }
      // Keep form populated on error
    });
  };

  return (
    <form key={formKey} onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      {actionResult && (
        <div className={`mb-4 p-3 rounded-md text-sm ${actionResult.error ? 'bg-destructive/10 text-destructive border border-destructive/30' : 'bg-green-100 text-green-800 border border-green-200'}`}>
          <div className="flex items-center gap-2">
             {actionResult.error ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
             <span>{actionResult.error || actionResult.message}</span>
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="foodId" className="block text-sm font-medium mb-1">Food Item</Label>
        <Select name="foodId" value={selectedFoodId} onValueChange={setSelectedFoodId} required>
          <SelectTrigger id="foodId">
            <SelectValue placeholder="Select a food..." />
          </SelectTrigger>
          <SelectContent>
            {foodLibrary.length === 0 ? (
              <SelectItem value="-" disabled>Your food library is empty</SelectItem>
            ) : (
              foodLibrary.map((food) => (
                <SelectItem key={food.id} value={food.id}>
                  {food.name} {food.brand_owner ? `(${food.brand_owner})` : ''}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        {selectedFood && (
             <p className="mt-1 text-xs text-muted-foreground">
                Serving: {selectedFood.serving_size_qty} {selectedFood.serving_size_unit}
             </p>
        )}
      </div>

      <div>
        <Label htmlFor="quantity" className="block text-sm font-medium mb-1">Quantity (Servings)</Label>
        <Input
          id="quantity"
          name="quantity"
          type="number"
          min="0.01"
          step="any" // Allow decimals
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
          placeholder="e.g., 1.5"
        />
         <p className="mt-1 text-xs text-muted-foreground">Multiplier for the standard serving size above.</p>
      </div>

      {/* Hidden input for mealId - already added to formData in handleSubmit */}
      {/* <input type="hidden" name="mealId" value={mealId} /> */}

      <Button type="submit" disabled={isPending || !selectedFoodId || foodLibrary.length === 0} className="w-full">
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Add Item to Meal
      </Button>
    </form>
  );
}
