'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Database } from '@/lib/database.types';
import { deleteMealTemplate } from '@/app/coach/actions'; // Import the delete action
import { formatDistanceToNow } from 'date-fns'; // For relative time formatting
import { Pencil, Trash2, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

type Meal = Database['public']['Tables']['meals']['Row'];
type ActionResult = { success: boolean; error?: string; message?: string };

interface MealListTableProps {
  meals: Meal[];
  deleteAction: typeof deleteMealTemplate; // Pass the server action as a prop
}

export function MealListTable({ meals, deleteAction }: MealListTableProps) {
  const [isPending, startTransition] = useTransition();
  const [actionResult, setActionResult] = useState<ActionResult | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDeleteClick = (mealId: string) => {
    setDeleteConfirmId(mealId);
    setActionResult(null); // Clear previous results
  };

  const handleConfirmDelete = (mealId: string) => {
    startTransition(async () => {
      const result = await deleteAction(mealId);
      setActionResult(result);
      if (result.success) {
        setDeleteConfirmId(null); // Close confirmation on success
        // Revalidation is handled by the server action
      }
      // Keep confirmation open on error
    });
  };

  const truncateDescription = (text: string | null, maxLength: number = 60): string => {
    if (!text) return '-';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <>
      {actionResult && !actionResult.success && (
        <div className={`mb-4 p-3 rounded-md text-sm bg-destructive/10 text-destructive border border-destructive/30`}>
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
              <th scope="col" className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground md:table-cell">Description</th>
              <th scope="col" className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground sm:table-cell">Last Updated</th>
              <th scope="col" className="relative px-4 py-3 sm:px-6"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {meals.map((meal) => (
              <tr key={meal.id}>
                <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-foreground sm:px-6">{meal.name}</td>
                <td className="hidden whitespace-normal px-4 py-4 text-sm text-muted-foreground md:table-cell max-w-xs">
                    {truncateDescription(meal.description)}
                </td>
                <td className="hidden whitespace-nowrap px-4 py-4 text-sm text-muted-foreground sm:table-cell">
                  {formatDistanceToNow(new Date(meal.updated_at), { addSuffix: true })}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-medium sm:px-6">
                  {deleteConfirmId === meal.id ? (
                    <div className="flex items-center justify-end space-x-2">
                       <span className="text-xs text-destructive">Delete?</span>
                       <Button
                         variant="destructive"
                         size="sm"
                         onClick={() => handleConfirmDelete(meal.id)}
                         disabled={isPending}
                       >
                         {isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                         Confirm
                       </Button>
                       <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(null)} disabled={isPending}>Cancel</Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end space-x-1">
                      <Button variant="ghost" size="icon" asChild title="Edit Meal Template">
                        <Link href={`/coach/nutrition/meals/${meal.id}/edit`}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteClick(meal.id)}
                        disabled={isPending}
                        title="Delete Meal Template"
                      >
                        <Trash2 className="h-4 w-4" />
                         <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
