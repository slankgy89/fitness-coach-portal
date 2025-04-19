'use client';

import { deleteExercise } from '@/app/coach/actions';
import { useState, useTransition } from 'react';

export default function ExerciseActions({ exerciseId }: { exerciseId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null); // Optional: display error inline

  const handleDelete = async () => {
    setError(null); // Clear previous errors
    if (window.confirm('Are you sure you want to delete this exercise? This cannot be undone.')) {
      startTransition(async () => {
        try {
          // The action handles redirection on success/error,
          // but we might catch unexpected issues here.
          await deleteExercise(exerciseId);
          // Revalidation and redirect happen in the server action
        } catch (e) {
          console.error("Delete action failed:", e);
          setError('Failed to initiate delete.'); // Show generic error
        }
      });
    }
  };

  return (
    <>
      <button
        onClick={handleDelete}
        disabled={isPending}
        className={`text-destructive hover:underline ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isPending ? 'Deleting...' : 'Delete'}
      </button>
      {/* Optional: Display error message inline */}
      {/* {error && <p className="text-xs text-destructive mt-1">{error}</p>} */}
    </>
  );
}
