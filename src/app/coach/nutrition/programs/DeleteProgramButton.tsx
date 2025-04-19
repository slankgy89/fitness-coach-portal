'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Loader2, AlertCircle } from 'lucide-react';
import { deleteNutritionProgramTemplate } from '@/app/coach/actions'; // We will create this action next
import { toast } from 'react-hot-toast'; // Assuming you use react-hot-toast

interface DeleteProgramButtonProps {
  programId: string;
  programName: string;
}

type ActionResult = { success: boolean; error?: string; message?: string };

export function DeleteProgramButton({ programId, programName }: DeleteProgramButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setError(null);
    startTransition(async () => {
      const result: ActionResult = await deleteNutritionProgramTemplate(programId); // Call server action

      if (result.success) {
        toast.success(`Program "${programName}" deleted successfully.`);
        setIsOpen(false); // Close the dialog on success
        // Revalidation should happen via the server action (revalidatePath)
      } else {
        setError(result.error || 'Failed to delete program.');
        toast.error(`Error deleting program: ${result.error || 'Unknown error'}`);
      }
    });
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Delete Program" className="text-destructive hover:text-destructive hover:bg-destructive/10">
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Delete</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the nutrition program template
            <span className="font-semibold"> "{programName}"</span> and all associated meals and items.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md flex items-center gap-1">
            <AlertCircle className="h-4 w-4" /> {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isPending} className="bg-destructive hover:bg-destructive/90">
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
