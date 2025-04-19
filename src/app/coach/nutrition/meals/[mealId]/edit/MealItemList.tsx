'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Database } from '@/lib/database.types';
import { deleteMealItemFromTemplate } from '@/app/coach/actions'; // Action to be created
import { Trash2, Loader2, AlertCircle, CheckCircle, GripVertical } from 'lucide-react'; // Import icons

type MealItem = Database['public']['Tables']['meal_items']['Row'];
type Food = Database['public']['Tables']['foods']['Row'];
type ActionResult = { success: boolean; error?: string; message?: string };

// Define the structure for meal items with nested food data (matching page.tsx)
type MealItemWithFood = MealItem & {
  foods: Food | null; // Food might be null if deleted
};

interface MealItemListProps {
  mealId: string; // Need mealId for revalidation/context
  items: MealItemWithFood[];
  // TODO: Add reorder functionality later
}

export function MealItemList({ mealId, items }: MealItemListProps) {
  const [isPending, startTransition] = useTransition();
  const [actionResult, setActionResult] = useState<ActionResult | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  const handleDelete = (itemId: string) => {
    setActionResult(null); // Clear previous results
    setDeletingItemId(itemId); // Indicate which item is being deleted

    startTransition(async () => {
      const result = await deleteMealItemFromTemplate(itemId, mealId); // Pass mealId for revalidation context
      setActionResult(result);
      setDeletingItemId(null); // Clear deleting indicator regardless of outcome
      // Revalidation happens via the server action
    });
  };

  // Basic calculation for display (example)
  const calculateTotalCalories = (item: MealItemWithFood): number => {
    if (!item.foods) return 0;
    // Quantity is a multiplier of the food's standard serving
    return (item.foods.calories || 0) * item.quantity;
  };

  return (
    <div className="space-y-3">
       {actionResult && (
        <div className={`mb-3 p-2 rounded-md text-xs ${actionResult.error ? 'bg-destructive/10 text-destructive border border-destructive/30' : 'bg-green-100 text-green-800 border border-green-200'}`}>
          <div className="flex items-center gap-1.5">
             {actionResult.error ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
             <span>{actionResult.error || actionResult.message}</span>
          </div>
        </div>
      )}

      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3 shadow-sm">
          {/* Drag Handle (for future reordering) */}
           <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab flex-shrink-0" />

          <div className="flex-grow">
            {item.foods ? (
              <>
                <p className="font-medium text-sm text-foreground">
                  {item.quantity} x {item.foods.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  (Serving: {item.foods.serving_size_qty} {item.foods.serving_size_unit} | ~{calculateTotalCalories(item).toFixed(0)} kcal)
                </p>
              </>
            ) : (
              <p className="text-sm text-destructive italic">[Food data missing]</p>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
            onClick={() => handleDelete(item.id)}
            disabled={isPending}
            title="Remove Item"
          >
            {isPending && deletingItemId === item.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            <span className="sr-only">Remove Item</span>
          </Button>
        </div>
      ))}
    </div>
  );
}
