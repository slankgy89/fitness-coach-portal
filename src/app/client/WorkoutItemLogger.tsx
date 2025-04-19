'use client'; // This needs to be a Client Component for interactivity

import React, { useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import { logWorkoutSet, updateWorkoutSet } from './actions'; // Import both actions
import { format } from 'date-fns'; // Import for formatting time

// Define types needed within this component
type ExerciseDetails = {
    id: string;
    name: string;
    description: string | null;
    instructions: string | null;
    video_url: string | null;
};
// Define type for workout logs passed as props or fetched
type WorkoutLog = {
    id: string;
    set_number: number;
    reps_completed: number | null;
    weight_used: number | null;
    weight_unit: string | null;
    duration_seconds: number | null; // Duration of the exercise itself
    rest_taken_seconds: number | null; // Rest taken *after* this set
    notes: string | null;
    logged_at: string;
    exercise_id: string;
    client_id?: string; // Optional as it might not always be needed in the component
    assigned_workout_id?: string; // Optional as it might not always be needed in the component
};
type WorkoutItemDetails = {
    id: string; // ID of the workout_template_item
    exercise_id: string;
    item_order: number;
    sets: string | null;
    reps: string | null;
    rest_period: string | null;
    notes: string | null;
    exercises: ExerciseDetails[] | null; // Primary exercise details
    alternative_exercise_id?: string | null; // Added optional alternative ID
    alternativeExercise?: ExerciseDetails | null; // Added optional alternative details
};

interface WorkoutItemLoggerProps {
    item: WorkoutItemDetails;
    index: number;
    assignedWorkoutId: string;
    initialLogs?: WorkoutLog[];
    // Alternative exercise details are now part of the 'item' prop
}

export default function WorkoutItemLogger({ item, index, assignedWorkoutId, initialLogs = [] }: WorkoutItemLoggerProps) {
    // State to track if the alternative exercise is shown
    const [showAlternative, setShowAlternative] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [repsInput, setRepsInput] = useState('');
    const [weightInput, setWeightInput] = useState('');
    const [weightUnit, setWeightUnit] = useState('kg');
    const [durationInput, setDurationInput] = useState('');
    const [durationUnit, setDurationUnit] = useState('SEC'); // SEC or MIN
    const [restInput, setRestInput] = useState('');
    const [restUnit, setRestUnit] = useState('SEC'); // SEC or MIN
    const [notesInput, setNotesInput] = useState(''); // State for notes textarea
    const [editingSet, setEditingSet] = useState<number | null>(null);
    const [editingLogId, setEditingLogId] = useState<string | null>(null);
    const [displayedLogs, setDisplayedLogs] = useState<WorkoutLog[]>(initialLogs);

    // Determine which exercise details to display
    const originalExercise = item.exercises?.[0];
    const alternativeExercise = item.alternativeExercise; // Get from props
    const currentExercise = showAlternative && alternativeExercise ? alternativeExercise : originalExercise;

     useEffect(() => {
        setDisplayedLogs(initialLogs);
     }, [initialLogs]);

    const handleRepsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value === '' || (/^\d+$/.test(value) && parseInt(value, 10) <= 999)) {
            setRepsInput(value);
        }
    };
    const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value === '' || (/^\d*\.?\d*$/.test(value) && parseFloat(value) <= 9999)) {
             setWeightInput(value);
        } else if (value === '') {
             setWeightInput('');
        }
    };
    const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        // Allow only numbers, max 4 digits
        if (value === '' || (/^\d+$/.test(value) && parseInt(value, 10) <= 9999)) {
            setDurationInput(value);
        }
    };
    const handleRestChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
         // Allow only numbers, max 4 digits
        if (value === '' || (/^\d+$/.test(value) && parseInt(value, 10) <= 9999)) {
            setRestInput(value);
        }
    };

    const numSets = parseInt(item.sets?.split('-')[0] ?? '1', 10) || 1;

    // Helper to convert input+unit to seconds
    const getTimeInSeconds = (value: string, unit: string): number | null => {
        const num = parseInt(value, 10);
        if (isNaN(num)) return null;
        return unit === 'MIN' ? num * 60 : num;
    };

    const handleLogSubmit = (setNumber: number) => {
        // Basic validation - adjust as needed
        if (!editingSet && !repsInput && !durationInput) {
             alert("Please enter reps or duration.");
             return;
        }
        if (!editingSet && repsInput && !weightInput) {
             alert("Please enter weight if logging reps.");
             return;
        }


        startTransition(async () => {
            const formData = new FormData();
            formData.append('assignedWorkoutId', assignedWorkoutId);
            formData.append('exerciseId', currentExercise?.id ?? item.exercise_id); // Use current exercise ID
            formData.append('setNumber', setNumber.toString());
            formData.append('repsCompleted', repsInput || ''); // Send empty string if not provided
            formData.append('weightUsed', weightInput || ''); // Send empty string if not provided
            formData.append('weightUnit', weightUnit);
            const durationSeconds = getTimeInSeconds(durationInput, durationUnit);
            const restSeconds = getTimeInSeconds(restInput, restUnit);
            formData.append('durationSeconds', durationSeconds?.toString() ?? '');
            formData.append('restTakenSeconds', restSeconds?.toString() ?? '');
            formData.append('notes', notesInput); // Add notes to form data


            if (editingLogId) {
                 formData.append('logId', editingLogId);
                 const result = await updateWorkoutSet(formData);
                 if (result?.error) {
                    alert(`Error updating set: ${result.error}`);
                 } else if (result?.updatedLog) {
                    setDisplayedLogs(prevLogs =>
                        prevLogs.map(log =>
                            log.id === result.updatedLog!.id ? result.updatedLog! : log
                        )
                    );
                    alert(`Set ${setNumber} updated successfully!`);
                 }
                 setEditingSet(null);
                 setEditingLogId(null);
                 setRepsInput('');
                  setWeightInput('');
                  setDurationInput('');
                  setRestInput('');
                  setNotesInput(''); // Clear notes on successful update
                  // Keep units as they were
            } else {
                const result = await logWorkoutSet(formData);
                if (result?.error) {
                    alert(`Error logging set: ${result.error}`);
                } else if (result?.newLog) {
                    setDisplayedLogs(prevLogs => [...prevLogs, result.newLog!]);
                    alert(`Set ${setNumber} logged successfully!`);
                    setRepsInput('');
                     setWeightInput('');
                     setDurationInput('');
                     setRestInput('');
                     setNotesInput(''); // Clear notes on successful log
                     // Reset units? Maybe keep them for next set.
                    // setWeightUnit('kg');
                    // setDurationUnit('SEC');
                    // setRestUnit('SEC');
                }
            }
        });
    };

    const handleEditClick = (log: WorkoutLog) => {
        setEditingSet(log.set_number);
        setEditingLogId(log.id);
        setRepsInput(log.reps_completed?.toString() ?? '');
        setWeightInput(log.weight_used?.toString() ?? '');
        setWeightUnit(log.weight_unit ?? 'kg');
        // Convert seconds back to input value and unit for editing
        if (log.duration_seconds !== null) {
            if (log.duration_seconds >= 60 && log.duration_seconds % 60 === 0) {
                setDurationInput((log.duration_seconds / 60).toString());
                setDurationUnit('MIN');
            } else {
                setDurationInput(log.duration_seconds.toString());
                setDurationUnit('SEC');
            }
        } else {
            setDurationInput('');
            setDurationUnit('SEC');
        }
        if (log.rest_taken_seconds !== null) {
             if (log.rest_taken_seconds >= 60 && log.rest_taken_seconds % 60 === 0) {
                setRestInput((log.rest_taken_seconds / 60).toString());
                setRestUnit('MIN');
            } else {
                setRestInput(log.rest_taken_seconds.toString());
                setRestUnit('SEC');
            }
        } else {
            setRestInput('');
            setRestUnit('SEC');
        }
        setNotesInput(log.notes ?? ''); // Populate notes on edit
    };

    const handleCancelEdit = () => {
        setEditingSet(null);
        setEditingLogId(null);
        setRepsInput('');
        setWeightInput('');
        setDurationInput('');
        setRestInput('');
        setNotesInput(''); // Clear notes on cancel
        // Reset units?
        // setWeightUnit('kg');
        // setDurationUnit('SEC');
        // setRestUnit('SEC');
    };

    const loggedSetMap = new Map(displayedLogs.map(log => [log.set_number, log]));
    const nextSetToLog = Array.from({ length: numSets }).findIndex((_, i) => !loggedSetMap.has(i + 1)) + 1;

    return (
        <div className="rounded border border-border p-4 bg-card/50">
            {/* Exercise Info - Use currentExercise */}
            <h3 className="font-semibold text-lg mb-2">{index + 1}. {currentExercise?.name ?? 'Unknown Exercise'}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-sm">
                <div><span className="font-medium">Sets:</span> {item.sets || '-'}</div>
                <div><span className="font-medium">Reps:</span> {item.reps || '-'}</div>
                <div><span className="font-medium">Rest:</span> {item.rest_period || '-'}</div>
            </div>
            {currentExercise?.instructions && (
                <div className="mb-3">
                    <h4 className="font-medium text-sm mb-1">Instructions:</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{currentExercise.instructions}</p>
                </div>
            )}
            {currentExercise?.video_url && (
                <div className="mb-3">
                    <Link href={currentExercise.video_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                    Watch Video Guide &rarr;
                </Link>
            </div>
            )}
            {/* Toggle Button for Alternative Exercise */}
            {alternativeExercise && originalExercise && ( // Only show if both exist
                 <div className="mb-3">
                     <button
                         onClick={() => setShowAlternative(!showAlternative)}
                         className="text-xs text-blue-500 hover:underline"
                     >
                         {showAlternative ? `Use Original: ${originalExercise.name}` : `Replace with: ${alternativeExercise.name}`}
                     </button>
                 </div>
            )}
            {item.notes && ( // Display coach notes for the item
                <div className="mb-3">
                    <h4 className="font-medium text-sm mb-1">Coach Notes:</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.notes}</p>
                </div>
            )}

             {/* Logging Input Area - Now first */}
             <div className="mt-4 border-t border-border pt-4 space-y-3">
                <h4 className="font-medium text-sm mb-2">{editingSet ? `Editing Set ${editingSet}` : (nextSetToLog > 0 && nextSetToLog <= numSets ? `Log Set ${nextSetToLog}` : 'All Sets Logged')}:</h4>
                {/* Show inputs only if editing OR if there are sets left to log */}
                {(editingSet || (nextSetToLog > 0 && nextSetToLog <= numSets)) && (
                    <>
                        <div className="flex items-end gap-1">
                            <div>
                                <label htmlFor={`reps-${item.id}`} className="block text-xs font-medium text-muted-foreground">Reps</label>
                                <input
                                    type="number" id={`reps-${item.id}`} value={repsInput} onChange={handleRepsChange}
                                    placeholder={item.reps || "0"} maxLength={3}
                                    className="mt-1 block w-12 rounded-md border-input bg-background px-2 py-1 text-sm placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary" />
                            </div>
                            <div>
                                <label htmlFor={`weight-${item.id}`} className="block text-xs font-medium text-muted-foreground">Weight</label>
                                <input
                                    type="number" step="any" id={`weight-${item.id}`} value={weightInput} onChange={handleWeightChange}
                                    placeholder="0" maxLength={4}
                                    className="mt-1 block w-16 rounded-md border-input bg-background px-2 py-1 text-sm placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary" />
                            </div>
                            <div>
                                <label htmlFor={`unit-${item.id}`} className="block text-xs font-medium text-muted-foreground">Unit</label>
                                <select
                                    id={`unit-${item.id}`} value={weightUnit} onChange={(e) => setWeightUnit(e.target.value)}
                                    className="mt-1 block w-14 rounded-md border-input bg-background px-1 py-1 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                                >
                                    <option value="kg">kg</option>
                                    <option value="lbs">lbs</option>
                                </select>
                            </div>
                             {/* Time Input (formerly Duration) */}
                             <div>
                                <label htmlFor={`duration-${item.id}`} className="block text-xs font-medium text-muted-foreground">Time</label>
                                <input
                                    type="number" id={`duration-${item.id}`} value={durationInput} onChange={handleDurationChange}
                                    placeholder="0" maxLength={4}
                                    className="mt-1 block w-16 rounded-md border-input bg-background px-2 py-1 text-sm placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary" />
                            </div>
                            <div>
                                <label htmlFor={`duration-unit-${item.id}`} className="block text-xs font-medium text-muted-foreground">Unit</label>
                                <select
                                    id={`duration-unit-${item.id}`} value={durationUnit} onChange={(e) => setDurationUnit(e.target.value)}
                                    className="mt-1 block w-14 rounded-md border-input bg-background px-1 py-1 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                                >
                                    <option value="SEC">SEC</option>
                                    <option value="MIN">MIN</option>
                                </select>
                            </div>
                             {/* Rest Input */}
                             <div>
                                <label htmlFor={`rest-${item.id}`} className="block text-xs font-medium text-muted-foreground">Rest Taken</label>
                                <input
                                    type="number" id={`rest-${item.id}`} value={restInput} onChange={handleRestChange}
                                    placeholder="0" maxLength={4}
                                    className="mt-1 block w-16 rounded-md border-input bg-background px-2 py-1 text-sm placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary" />
                            </div>
                            <div>
                                <label htmlFor={`rest-unit-${item.id}`} className="block text-xs font-medium text-muted-foreground">Unit</label>
                                <select
                                    id={`rest-unit-${item.id}`} value={restUnit} onChange={(e) => setRestUnit(e.target.value)}
                                    className="mt-1 block w-14 rounded-md border-input bg-background px-1 py-1 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                                >
                                    <option value="SEC">SEC</option>
                                    <option value="MIN">MIN</option>
                                </select>
                            </div>
                        </div>
                         {/* Notes Textarea */}
                         <div className="w-full">
                             <label htmlFor={`notes-${item.id}`} className="block text-xs font-medium text-muted-foreground">Notes</label>
                             <textarea
                                 id={`notes-${item.id}`}
                                 value={notesInput}
                                 onChange={(e) => setNotesInput(e.target.value)}
                                 rows={2}
                                 placeholder="Add any notes for this set..."
                                 className="mt-1 block w-full rounded-md border-input bg-background px-2 py-1 text-sm placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                             />
                         </div>
                        <div className="flex flex-wrap gap-2">
                            {editingSet ? (
                                <>
                                    {/* Basic validation for button disable - adjust as needed */}
                                    <button onClick={() => handleLogSubmit(editingSet)} disabled={isPending || !!((!repsInput && !durationInput) || (repsInput && !weightInput))} className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
                                        Update Set {editingSet}
                                    </button>
                                    <button type="button" onClick={handleCancelEdit} disabled={isPending} className="rounded bg-gray-500 px-3 py-1 text-sm text-white hover:bg-gray-600 disabled:opacity-50">
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                // Only show button for the next unlogged set
                                nextSetToLog > 0 && nextSetToLog <= numSets && (
                                    <button
                                        onClick={() => handleLogSubmit(nextSetToLog)}
                                        disabled={isPending || !!((!repsInput && !durationInput) || (repsInput && !weightInput))}
                                        className="rounded bg-secondary px-3 py-1 text-sm text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
                                    >
                                        Log Set {nextSetToLog}
                                    </button>
                                )
                            )}
                        </div>
                    </>
                )}
            </div>

             {/* Display Logged Sets Area - Now second */}
             {displayedLogs.length > 0 && (
                <div className="mt-4 border-t border-border pt-4 space-y-2">
                    <h4 className="font-medium text-sm">Logged Performance:</h4>
                    <ul className="list-none space-y-1 text-sm">
                        {displayedLogs.sort((a, b) => a.set_number - b.set_number).map(log => {
                            // Format duration and rest for display
                            const formatTime = (seconds: number | null): string => {
                                if (seconds === null || seconds === undefined) return '-';
                                if (seconds < 60) return `${seconds}s`;
                                const mins = Math.floor(seconds / 60);
                                const secs = seconds % 60;
                                return `${mins}m${secs > 0 ? ` ${secs}s` : ''}`;
                            };
                            const durationDisplay = formatTime(log.duration_seconds);
                            const restDisplay = formatTime(log.rest_taken_seconds);

                            return (
                                <li key={log.id} className="flex justify-between items-center gap-2">
                                    <span className="flex-grow">
                                        Set {log.set_number}:
                                        {log.reps_completed !== null && log.weight_used !== null && ` ${log.reps_completed} reps @ ${log.weight_used} ${log.weight_unit ?? ''}`}
                                        {log.duration_seconds !== null && ` Time: ${durationDisplay}`} {/* Renamed Duration to Time */}
                                        {log.rest_taken_seconds !== null && ` (Rest: ${restDisplay})`}
                                        {log.notes && <span className="block text-xs text-muted-foreground italic pl-2">Note: {log.notes}</span>} {/* Display notes */}
                                        <span className="text-xs text-muted-foreground ml-2">({format(new Date(log.logged_at), 'p')})</span>
                                    </span>
                                    <button
                                        onClick={() => handleEditClick(log)}
                                        disabled={isPending || editingSet === log.set_number}
                                        className="text-xs text-blue-500 hover:underline disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                                    >
                                        Edit
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
}
