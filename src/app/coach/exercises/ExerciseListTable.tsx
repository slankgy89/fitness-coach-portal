'use client';

import Link from 'next/link';
import { useState, useTransition, ChangeEvent } from 'react';
import ExerciseActions from './ExerciseActions'; // For single delete
import { deleteMultipleExercises } from '@/app/coach/actions'; // For bulk delete

// Update Exercise type to include new fields
type Exercise = {
  id: string;
  name: string;
  body_part: string; // Added
  machine_type: string; // Added
  exercise_type: string; // Added Exercise Type
  description: string | null;
  video_url: string | null;
};

interface ExerciseListTableProps {
  exercises: Exercise[];
}

export default function ExerciseListTable({ exercises }: ExerciseListTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const handleSelectAll = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(exercises.map(ex => ex.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectSingle = (event: ChangeEvent<HTMLInputElement>, id: string) => {
    if (event.target.checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) {
      alert('Please select at least one exercise to delete.');
      return;
    }
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} selected exercise(s)? This cannot be undone.`)) {
      startTransition(async () => {
        try {
          await deleteMultipleExercises(selectedIds);
          // Action handles redirect and revalidation
          setSelectedIds([]); // Clear selection after action call
        } catch (e) {
          console.error("Bulk delete action failed:", e);
          alert('Failed to initiate bulk delete.'); // Show generic error
        }
      });
    }
  };

  const isAllSelected = exercises.length > 0 && selectedIds.length === exercises.length;

  return (
    <>
      {exercises.length > 0 && (
        <div className="mb-4 flex justify-start">
          <button
            onClick={handleDeleteSelected}
            disabled={isPending || selectedIds.length === 0}
            className={`rounded-md border border-destructive bg-destructive/10 px-3 py-1.5 text-sm font-semibold text-destructive shadow-sm hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-50 ${isPending ? 'animate-pulse' : ''}`}
          >
            {isPending ? 'Deleting...' : `Delete Selected (${selectedIds.length})`}
          </button>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                  aria-label="Select all exercises"
                />
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Body Part</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Equipment/Type</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Exercise Type</th> {/* Added Header */}
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Description</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Video</th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {exercises.map((ex) => (
              <tr key={ex.id} className={selectedIds.includes(ex.id) ? 'bg-muted/30' : ''}>
                <td className="px-4 py-4">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                    checked={selectedIds.includes(ex.id)}
                    onChange={(e) => handleSelectSingle(e, ex.id)}
                    aria-label={`Select exercise ${ex.name}`}
                  />
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-foreground">{ex.name}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">{ex.body_part}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">{ex.machine_type}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">{ex.exercise_type ?? '-'}</td> {/* Added Cell */}
                <td className="whitespace-normal px-6 py-4 text-sm text-muted-foreground">{ex.description || '-'}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                  {ex.video_url ? (
                    <Link href={ex.video_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      Watch
                    </Link>
                  ) : '-'}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium space-x-4">
                  <Link href={`/coach/exercises/${ex.id}/edit`} className="text-primary hover:underline">
                    Edit
                  </Link>
                  {/* Keep single delete action */}
                  <ExerciseActions exerciseId={ex.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
