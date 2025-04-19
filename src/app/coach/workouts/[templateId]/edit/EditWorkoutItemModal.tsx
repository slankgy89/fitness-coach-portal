'use client';

import { useState, useEffect, useTransition, FormEvent, ChangeEvent, Dispatch, SetStateAction } from 'react';
import { updateWorkoutItem } from '@/app/coach/actions'; // Assuming updateWorkoutItem returns { success: boolean, error?: string }
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Button } from '@/components/ui/button';

// Types
type Exercise = {
  id: string;
  name: string;
  body_part: string;
  machine_type: string;
  exercise_type: string;
};

type SetDetail = {
  set: number;
  reps: string;
  weight: string;
  time: string;
  rest: string;
  resistance?: string | null;
  speed?: string | null;
  incline?: string | null;
};

type FieldErrors = {
  [setIndex: number]: {
    [field in keyof Omit<SetDetail, 'set'>]?: string;
  };
};

// Define a more specific type for the item prop
type WorkoutItemForModal = {
  id: string;
  template_id: string;
  exercise_id: string;
  alternative_exercise_id: string | null;
  sets: number | null;
  notes: string | null;
  set_details: any | null;
  alt_set_details?: any | null;
  superset_exercise_id?: string | null;
  superset_set_details?: any | null;
  updated_at?: string;
};

interface EditWorkoutItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: WorkoutItemForModal | null;
  allExercises: Exercise[];
}

// Helper
const getUniqueValues = (items: any[], key: string): string[] => {
   const validItems = items.map(item => item?.[key]).filter(value => value != null);
   return Array.from(new Set(validItems as string[])).sort();
};

const deepEqual = (obj1: any, obj2: any): boolean => {
    if (obj1 === obj2) return true;
    if (obj1 == null || obj2 == null || typeof obj1 !== 'object' || typeof obj2 !== 'object') {
        return false;
    }
    try {
        return JSON.stringify(obj1) === JSON.stringify(obj2);
    } catch (e) {
        console.error("Deep comparison failed:", e);
        return false;
    }
};

// Regex
const weightRegex = /^(|\d+(\.\d+)?\s*(kg|lbs|bw)?)$/i;
const timeRegex = /^(|\d+\s*(sec|min|hr)?)$/i;
const repsRegex = /^(|\d+(-\d+)?|amrap)$/i;
const resistanceRegex = /^(|Lvl\s*\d+|Small|Medium|Large|Ex\.?\s*Large)$/i;
const speedRegex = /^(|\d+(\.\d+)?\s*(Mph|Kmph)?)$/i;
const inclineRegex = /^(|Lvl\s*\d+|\d+(\.\d+)?\s*%?)$/i;


export default function EditWorkoutItemModal({ isOpen, onClose, item, allExercises }: EditWorkoutItemModalProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ primary: FieldErrors, alternative: FieldErrors, superset: FieldErrors }>({ primary: {}, alternative: {}, superset: {} });
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

  // Form state
  const initialSetDetail = (): Omit<SetDetail, 'set'> => ({ reps: '', weight: '', time: '', rest: '', resistance: null, speed: null, incline: null });
  const [numSets, setNumSets] = useState<number>(0);
  const [setDetails, setSetDetails] = useState<SetDetail[]>([]);
  const [altSetDetails, setAltSetDetails] = useState<SetDetail[]>([]);
  const [supersetSetDetails, setSupersetSetDetails] = useState<SetDetail[]>([]);
  const [currentExerciseId, setCurrentExerciseId] = useState<string>('');
  const [currentAltExerciseId, setCurrentAltExerciseId] = useState<string>('');
  const [currentSupersetExerciseId, setCurrentSupersetExerciseId] = useState<string>('');
  const [currentNotes, setCurrentNotes] = useState<string>('');

  // Initial state for comparison
  const [initialExerciseId, setInitialExerciseId] = useState<string>('');
  const [initialAltExerciseId, setInitialAltExerciseId] = useState<string>('');
  const [initialNotes, setInitialNotes] = useState<string>('');
  const [initialNumSets, setInitialNumSets] = useState<number>(0);
  const [initialSetDetails, setInitialSetDetails] = useState<SetDetail[]>([]);
  const [initialAltSetDetails, setInitialAltSetDetails] = useState<SetDetail[]>([]);
  const [initialSupersetSetDetails, setInitialSupersetSetDetails] = useState<SetDetail[]>([]);
  const [initialSupersetExerciseId, setInitialSupersetExerciseId] = useState<string>('');

  // Filtering State
  const [filterBodyPart, setFilterBodyPart] = useState<string>('');
  const [filterMachineType, setFilterMachineType] = useState<string>('');
  const [filterExerciseType, setFilterExerciseType] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Derive filter options and filtered exercises
  const bodyPartOptions = getUniqueValues(allExercises, 'body_part');
  const machineTypeOptions = getUniqueValues(allExercises, 'machine_type');
  const exerciseTypeOptions = getUniqueValues(allExercises, 'exercise_type');

  const filteredExercises = allExercises.filter(ex =>
    (filterBodyPart === '' || ex.body_part === filterBodyPart) &&
    (filterMachineType === '' || ex.machine_type === filterMachineType) &&
    (filterExerciseType === '' || ex.exercise_type === filterExerciseType) &&
    (searchTerm === '' || ex.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Parse and Pad Set Details
  const parseAndPadSetDetails = (detailsData: any, count: number): SetDetail[] => {
      let parsedDetails: SetDetail[] = [];
      if (detailsData) {
          try {
              let parsed = typeof detailsData === 'string' ? JSON.parse(detailsData) : detailsData;
              if (Array.isArray(parsed)) {
                  parsedDetails = parsed.map((d: any, i: number) => ({
                      set: d.set ?? i + 1,
                      reps: d.reps ?? '',
                      weight: d.weight ?? '',
                      time: d.time ?? '',
                      rest: d.rest ?? '',
                      resistance: d.resistance ?? null,
                      speed: d.speed ?? null,
                      incline: d.incline ?? null,
                  }));
              }
          } catch (e) { console.error("Failed to parse set_details:", e); }
      }
      while (parsedDetails.length < count) {
          parsedDetails.push({ set: parsedDetails.length + 1, ...initialSetDetail() });
      }
      if (parsedDetails.length > count) {
          parsedDetails = parsedDetails.slice(0, count);
      }
      return parsedDetails.map((d, i) => ({ ...d, set: i + 1 }));
  };

  // Populate state on open/item change
  useEffect(() => {
    if (item && isOpen) {
      const initialSets = item.sets ?? 0;
      const exerciseId = item.exercise_id;
      const altExerciseId = item.alternative_exercise_id ?? '';
      const supersetExerciseId = item.superset_exercise_id ?? '';
      const notes = item.notes ?? '';

      const parsedSetDetails = parseAndPadSetDetails(item.set_details, initialSets);
      const parsedAltSetDetails = parseAndPadSetDetails(item.alt_set_details, initialSets);
      const parsedSupersetSetDetails = parseAndPadSetDetails(item.superset_set_details, initialSets);

      setNumSets(initialSets);
      setCurrentExerciseId(exerciseId);
      setCurrentAltExerciseId(altExerciseId);
      setCurrentSupersetExerciseId(supersetExerciseId);
      setCurrentNotes(notes);
      setSetDetails(parsedSetDetails);
      setAltSetDetails(parsedAltSetDetails);
      setSupersetSetDetails(parsedSupersetSetDetails);

      // Store initial state for comparison
      setInitialNumSets(initialSets);
      setInitialExerciseId(exerciseId);
      setInitialAltExerciseId(altExerciseId);
      setInitialSupersetExerciseId(supersetExerciseId);
      setInitialNotes(notes);
      setInitialSetDetails(JSON.parse(JSON.stringify(parsedSetDetails)));
      setInitialAltSetDetails(JSON.parse(JSON.stringify(parsedAltSetDetails)));
      setInitialSupersetSetDetails(JSON.parse(JSON.stringify(parsedSupersetSetDetails)));

    } else if (!isOpen) {
       // Reset state when modal closes
       setError(null);
       setFieldErrors({ primary: {}, alternative: {}, superset: {} });
       setShowUnsavedWarning(false);
    }
  }, [item, isOpen]);

  // Sync sets effect
  useEffect(() => {
    if (!isOpen) return;
    if (!item && numSets === 0) return; // Avoid running on initial mount before item is loaded

    const syncSets = (currentDetails: SetDetail[]): SetDetail[] => {
        const newDetails: SetDetail[] = [];
        for (let i = 0; i < numSets; i++) {
            newDetails.push(currentDetails[i] || { set: i + 1, ...initialSetDetail() });
        }
        return newDetails.slice(0, numSets).map((detail, index) => ({ ...detail, set: index + 1 }));
    };

    // Only update if the number of sets requires adjustment
    if (setDetails.length !== numSets) setSetDetails(current => syncSets(current));
    if (altSetDetails.length !== numSets) setAltSetDetails(current => syncSets(current));
    if (supersetSetDetails.length !== numSets) setSupersetSetDetails(current => syncSets(current));

  }, [numSets, item, isOpen]); // Removed initialSetDetail dependency


  // Handlers
  const handleNumSetsChange = (e: ChangeEvent<HTMLInputElement>) => {
    const count = parseInt(e.target.value, 10) || 0;
    setNumSets(Math.max(0, Math.min(count, 20)));
  };

  const makeHandleDetailChange = (
      setter: Dispatch<SetStateAction<SetDetail[]>>,
      section: 'primary' | 'alternative' | 'superset'
  ) => (index: number, field: keyof Omit<SetDetail, 'set'>, value: string) => {
      setFieldErrors(prev => {
          const newSectionErrors = { ...prev[section] };
          if (newSectionErrors[index]) {
              delete newSectionErrors[index]![field];
              if (Object.keys(newSectionErrors[index]!).length === 0) {
                  delete newSectionErrors[index];
              }
          }
          return { ...prev, [section]: newSectionErrors };
      });
      setter(currentDetails =>
          currentDetails.map((detail, i) =>
              i === index ? { ...detail, [field]: value } : detail
          )
      );
  };

  const handleSetDetailChange = makeHandleDetailChange(setSetDetails, 'primary');
  const handleAltSetDetailChange = makeHandleDetailChange(setAltSetDetails, 'alternative');
  const handleSupersetSetDetailChange = makeHandleDetailChange(setSupersetSetDetails, 'superset');

  // Check for changes
  const hasChanges = () => {
      if (!item) return false;
      if (currentExerciseId !== initialExerciseId) return true;
      if (currentAltExerciseId !== initialAltExerciseId) return true;
      if (currentSupersetExerciseId !== initialSupersetExerciseId) return true;
      if (currentNotes !== initialNotes) return true;
      if (numSets !== initialNumSets) return true;
      if (!deepEqual(setDetails, initialSetDetails)) return true;
      if ((currentAltExerciseId || initialAltExerciseId) && !deepEqual(altSetDetails, initialAltSetDetails)) return true;
      if ((currentSupersetExerciseId || initialSupersetExerciseId) && !deepEqual(supersetSetDetails, initialSupersetSetDetails)) return true;
      return false;
  };


  // Close handler
  const handleClose = () => {
      if (hasChanges()) {
          setShowUnsavedWarning(true);
      } else {
          setShowUnsavedWarning(false);
          setError(null);
          setFieldErrors({ primary: {}, alternative: {}, superset: {} });
          onClose();
       }
  };

  // Revert changes
  const revertChanges = () => {
      if (!item) return;
      setCurrentExerciseId(initialExerciseId);
      setCurrentAltExerciseId(initialAltExerciseId);
      setCurrentSupersetExerciseId(initialSupersetExerciseId);
      setCurrentNotes(initialNotes);
      setNumSets(initialNumSets);
      setSetDetails(parseAndPadSetDetails(initialSetDetails, initialNumSets));
      setAltSetDetails(parseAndPadSetDetails(initialAltSetDetails, initialNumSets));
      setSupersetSetDetails(parseAndPadSetDetails(initialSupersetSetDetails, initialNumSets));
      setShowUnsavedWarning(false);
      setError(null);
      setFieldErrors({ primary: {}, alternative: {}, superset: {} });
  };


  // Validation Logic
  const validateSetDetails = (details: SetDetail[]): FieldErrors => {
    const errors: FieldErrors = {};
    details.forEach((detail, i) => {
        const setErrors: { [field in keyof Omit<SetDetail, 'set'>]?: string } = {};
        const reps = detail.reps?.trim() ?? '';
        const weight = detail.weight?.trim() ?? '';
        const time = detail.time?.trim() ?? '';
        const rest = detail.rest?.trim() ?? '';
        const resistance = detail.resistance?.trim() ?? '';
        const speed = detail.speed?.trim() ?? '';
        const incline = detail.incline?.trim() ?? '';

        if (reps && !repsRegex.test(reps)) setErrors.reps = 'Invalid format (e.g., 8, 8-12, amrap)';
        if (weight && !weightRegex.test(weight)) setErrors.weight = 'Invalid format (e.g., 50 kg, 100 lbs, BW)';
        if (time && !timeRegex.test(time)) setErrors.time = 'Invalid format (e.g., 60 sec, 2 min)';
        if (rest && !timeRegex.test(rest)) setErrors.rest = 'Invalid format (e.g., 90 sec, 3 min)';
        if (resistance && !resistanceRegex.test(resistance)) setErrors.resistance = 'Invalid (Lvl #, Small, Medium, Large, Ex. Large)';
        if (speed && !speedRegex.test(speed)) setErrors.speed = 'Invalid format (e.g., 5 Mph, 10 Kmph)';
        if (incline && !inclineRegex.test(incline)) setErrors.incline = 'Invalid format (e.g., Lvl 3, 5%)';

        if (Object.keys(setErrors).length > 0) {
            errors[i] = setErrors;
        }
    });
    return errors;
  };

   // Function to validate a single field and update errors
   const validateSingleField = (
       section: 'primary' | 'alternative' | 'superset',
       index: number,
       field: keyof Omit<SetDetail, 'set'>,
       value: string
   ) => {
       const trimmedValue = value.trim();
       let errorMsg: string | undefined = undefined;
       let regex: RegExp | null = null;
       let example: string = '';

       switch (field) {
           case 'reps': regex = repsRegex; example = 'e.g., 8, 8-12, amrap'; break;
           case 'weight': regex = weightRegex; example = 'e.g., 50 kg, 100 lbs, BW'; break;
           case 'time':
           case 'rest': regex = timeRegex; example = 'e.g., 60 sec, 2 min'; break;
           case 'resistance': regex = resistanceRegex; example = 'Lvl #, Small, Medium, Large, Ex. Large'; break;
           case 'speed': regex = speedRegex; example = 'e.g., 5 Mph, 10 Kmph'; break;
           case 'incline': regex = inclineRegex; example = 'e.g., Lvl 3, 5%'; break;
       }

       if (regex && trimmedValue && !regex.test(trimmedValue)) {
           errorMsg = `Invalid format (${example})`;
       }

       setFieldErrors(prev => {
           const newSectionErrors = { ...prev[section] };
           const newSetErrors = { ...(newSectionErrors[index] ?? {}) };

           if (errorMsg) {
               newSetErrors[field] = errorMsg;
           } else {
               delete newSetErrors[field];
           }

           if (Object.keys(newSetErrors).length === 0) {
               delete newSectionErrors[index];
           } else {
               newSectionErrors[index] = newSetErrors;
           }

           const allErrors = { ...prev, [section]: newSectionErrors };
           if (!Object.values(allErrors.primary).some(set => Object.keys(set ?? {}).length > 0) &&
               !Object.values(allErrors.alternative).some(set => Object.keys(set ?? {}).length > 0) &&
               !Object.values(allErrors.superset).some(set => Object.keys(set ?? {}).length > 0)) {
               setError(null);
           }

           return { ...prev, [section]: newSectionErrors };
       });
   };

  const validateAllSetDetails = (): boolean => {
      let hasErrors = false;
      const newFieldErrors: { primary: FieldErrors, alternative: FieldErrors, superset: FieldErrors } = { primary: {}, alternative: {}, superset: {} };

      newFieldErrors.primary = validateSetDetails(setDetails.slice(0, numSets));
      if (Object.keys(newFieldErrors.primary).length > 0) hasErrors = true;

      if (currentAltExerciseId) {
          newFieldErrors.alternative = validateSetDetails(altSetDetails.slice(0, numSets));
          if (Object.keys(newFieldErrors.alternative).length > 0) hasErrors = true;
      }
      if (currentSupersetExerciseId) {
          newFieldErrors.superset = validateSetDetails(supersetSetDetails.slice(0, numSets));
          if (Object.keys(newFieldErrors.superset).length > 0) hasErrors = true;
      }

      setFieldErrors(newFieldErrors);
      return !hasErrors;
  };

  // Submit Handler
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!item) return;

    setError(null);
    setFieldErrors({ primary: {}, alternative: {}, superset: {} });
    setShowUnsavedWarning(false);

    const isValid = validateAllSetDetails();
    if (!isValid) {
        setError("Please fix the errors highlighted below.");
        return;
    }

    const exerciseId = currentExerciseId;
    const alternativeExerciseId = currentAltExerciseId || null;
    const supersetExerciseId = currentSupersetExerciseId || null;
    const notesValue = currentNotes || null;

    if (!exerciseId) {
        setError("Please select an exercise.");
        return;
    }
     if (numSets <= 0) {
        setError("Number of sets must be greater than 0.");
        return;
    }

    const finalSetDetails = setDetails.slice(0, numSets);
    const finalAltSetDetails = alternativeExerciseId ? altSetDetails.slice(0, numSets) : null;
    const finalSupersetSetDetails = supersetExerciseId ? supersetSetDetails.slice(0, numSets) : null;

    const setDetailsPayload = JSON.stringify(finalSetDetails.map(d => ({...d, resistance: d.resistance?.trim(), speed: d.speed?.trim(), incline: d.incline?.trim()})));
    const altSetDetailsPayload = finalAltSetDetails ? JSON.stringify(finalAltSetDetails.map(d => ({...d, resistance: d.resistance?.trim(), speed: d.speed?.trim(), incline: d.incline?.trim()}))) : null;
    const supersetSetDetailsPayload = finalSupersetSetDetails ? JSON.stringify(finalSupersetSetDetails.map(d => ({...d, resistance: d.resistance?.trim(), speed: d.speed?.trim(), incline: d.incline?.trim()}))) : null;

    const actionFormData = new FormData();
    actionFormData.append('exerciseId', exerciseId);
    if (alternativeExerciseId) actionFormData.append('alternativeExerciseId', alternativeExerciseId);
    if (supersetExerciseId) actionFormData.append('supersetExerciseId', supersetExerciseId);
    actionFormData.append('sets', String(numSets));
    actionFormData.append('set_details', setDetailsPayload);
    if (altSetDetailsPayload) actionFormData.append('alt_set_details', altSetDetailsPayload);
    if (supersetSetDetailsPayload) actionFormData.append('superset_set_details', supersetSetDetailsPayload);
    if (notesValue) actionFormData.append('notes', notesValue);

    startTransition(async () => {
      try {
        // Define expected return type for updateWorkoutItem
        type ActionResult = { success: boolean; error?: string };
        const result: ActionResult | undefined = await updateWorkoutItem(item.id, item.template_id, actionFormData);

        if (result?.success) {
            setInitialExerciseId(currentExerciseId);
            setInitialAltExerciseId(currentAltExerciseId);
            setInitialSupersetExerciseId(currentSupersetExerciseId);
            setInitialNotes(currentNotes);
            setInitialNumSets(numSets);
            setInitialSetDetails(JSON.parse(JSON.stringify(finalSetDetails)));
            setInitialAltSetDetails(JSON.parse(JSON.stringify(finalAltSetDetails ?? [])));
            setInitialSupersetSetDetails(JSON.parse(JSON.stringify(finalSupersetSetDetails ?? [])));
            onClose();
        } else {
             setError(result?.error || 'Failed to update item.');
        }
      } catch (e: any) {
        console.error("Update item action failed:", e);
        setError('An unexpected error occurred while updating.');
      }
    });
  };

  // Helper to check if a specific section has errors
  const sectionHasErrors = (section: 'primary' | 'alternative' | 'superset'): boolean => {
      return Object.values(fieldErrors[section]).some(set => Object.keys(set ?? {}).length > 0);
  };

  // Helper function to render set detail rows with tooltips
  const renderSetDetailRows = (
      details: SetDetail[],
      handler: (index: number, field: keyof Omit<SetDetail, 'set'>, value: string) => void,
      errorSection: FieldErrors,
      keyPrefix: string
  ) => (
      <TooltipProvider delayDuration={100}>
          {details.map((detail, index) => (
              <div key={`${keyPrefix}-${index}`} className="grid grid-cols-1 gap-x-2 gap-y-2 sm:grid-cols-8">
                  <span className="font-medium sm:col-span-1 sm:text-right self-center">Set {detail.set}:</span>
                  {(Object.keys(initialSetDetail()) as Array<keyof Omit<SetDetail, 'set'>>).map((field) => (
                      <div key={field} className="sm:col-span-1">
                          <Tooltip>
                              <TooltipTrigger asChild>
                                  <input
                                      type="text"
                                      placeholder={`e.g. ${field === 'reps' ? '8-12' : field === 'weight' ? '50 kg' : field === 'time' || field === 'rest' ? '60 sec' : field === 'resistance' ? 'Lvl 5' : field === 'speed' ? '10kph' : '5%'}`}
                                      value={(detail as any)[field] ?? ''}
                                      onChange={(e: ChangeEvent<HTMLInputElement>) => handler(index, field, e.target.value)}
                                      onBlur={(e: ChangeEvent<HTMLInputElement>) => validateSingleField(
                                          keyPrefix as 'primary' | 'alternative' | 'superset',
                                          index,
                                          field,
                                          e.target.value
                                      )}
                                      className={cn(
                                          "block w-full rounded-md border-input bg-background px-2 py-1 text-sm placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary",
                                          errorSection?.[index]?.[field] && "border-destructive bg-destructive/20 focus:ring-destructive"
                                      )}
                                  />
                              </TooltipTrigger>
                              {errorSection?.[index]?.[field] && (
                                  <TooltipContent side="top" className="bg-destructive text-destructive-foreground text-xs p-1">
                                      <p>{errorSection[index]?.[field]}</p>
                                  </TooltipContent>
                              )}
                          </Tooltip>
                      </div>
                  ))}
              </div>
          ))}
      </TooltipProvider>
  );


  if (!isOpen || !item) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="relative w-full max-w-2xl rounded-lg bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="mb-4 text-xl font-semibold">Edit Workout Item</h2>

        {/* Filtering UI */}
         <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
            <input type="text" placeholder="Search exercise..." value={searchTerm} onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)} className="block w-full rounded-md border-input bg-background px-3 py-2 placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"/>
            <select value={filterBodyPart} onChange={(e: ChangeEvent<HTMLSelectElement>) => setFilterBodyPart(e.target.value)} className="block w-full rounded-md border-input bg-background px-3 py-2 text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm">
                 <option value="">All Body Parts</option>
                 {bodyPartOptions.map(part => <option key={part} value={part}>{part}</option>)}
            </select>
            <select value={filterMachineType} onChange={(e: ChangeEvent<HTMLSelectElement>) => setFilterMachineType(e.target.value)} className="block w-full rounded-md border-input bg-background px-3 py-2 text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm">
                 <option value="">All Equipment</option>
                 {machineTypeOptions.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
            <select
              value={filterExerciseType}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setFilterExerciseType(e.target.value)}
              className="block w-full rounded-md border-input bg-background px-3 py-2 text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
            >
              <option value="">All Exercise Types</option>
              {exerciseTypeOptions.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Exercise Selection */}
          <div>
            <label htmlFor="edit-exerciseId" className="block text-sm font-medium text-muted-foreground">Exercise</label>
            <select
                name="exerciseId"
                id="edit-exerciseId"
                required
                value={currentExerciseId}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setCurrentExerciseId(e.target.value)}
                className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
            >
              <option value="" disabled>Select an exercise</option>
              {filteredExercises.length === 0 && <option disabled>No matches found</option>}
              {filteredExercises.map(ex => (
                <option key={ex.id} value={ex.id}>{ex.name} ({ex.exercise_type} / {ex.body_part} / {ex.machine_type})</option>
              ))}
            </select>
          </div>

          {/* Alternative Exercise */}
           <div>
             <label htmlFor="edit-alternativeExerciseId" className="block text-sm font-medium text-muted-foreground">Alternative Exercise (Optional)</label>
             <select
                name="alternativeExerciseId"
                id="edit-alternativeExerciseId"
                value={currentAltExerciseId}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setCurrentAltExerciseId(e.target.value)}
                className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
            >
               <option value="">-- No Alternative --</option>
               {allExercises.map(ex => (
                 <option key={ex.id} value={ex.id}>{ex.name}</option>
               ))}
             </select>
           </div>

            {/* Superset Exercise */}
            <div>
              <label htmlFor="edit-supersetExerciseId" className="block text-sm font-medium text-muted-foreground">Superset Exercise (Optional)</label>
              <select
                 id="edit-supersetExerciseId"
                 value={currentSupersetExerciseId}
                 onChange={(e: ChangeEvent<HTMLSelectElement>) => setCurrentSupersetExerciseId(e.target.value)}
                 className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
             >
                <option value="">-- No Superset --</option>
                {allExercises.map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>
            </div>

           {/* Notes */}
            <div>
                <label htmlFor="edit-notes" className="block text-sm font-medium text-muted-foreground">Notes (Optional)</label>
                <textarea
                    id="edit-notes"
                    name="notes"
                    rows={2}
                    value={currentNotes}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setCurrentNotes(e.target.value)}
                    className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                    placeholder="Add any specific notes for this exercise..."
                />
            </div>


          {/* Number of Sets Input */}
          <div>
            <label htmlFor="edit-numSets" className="block text-sm font-medium text-muted-foreground">Number of Sets</label>
            <input
              type="number"
              id="edit-numSets"
              name="sets"
              value={numSets}
              onChange={handleNumSetsChange}
              min="1" max="20" required
              className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
            />
          </div>

          {/* Dynamic Primary Set Detail Inputs */}
          {numSets > 0 && (
            <div className="space-y-3 rounded border border-border p-3">
             <h3 className="text-md font-medium text-muted-foreground mb-2">Exercise Details</h3>
             {error && sectionHasErrors('primary') && <p className="mb-2 text-sm text-destructive">{error}</p>}
             <div className="grid grid-cols-1 gap-x-2 gap-y-2 sm:grid-cols-8 mb-1 pr-1">
                 <span className="font-medium sm:col-span-1 sm:text-right text-xs text-muted-foreground"></span>
                 <div className="sm:col-span-1 text-xs font-medium text-muted-foreground">Reps</div>
                 <div className="sm:col-span-1 text-xs font-medium text-muted-foreground">Weight</div>
                  <div className="sm:col-span-1 text-xs font-medium text-muted-foreground">Time</div>
                  <div className="sm:col-span-1 text-xs font-medium text-muted-foreground">Rest</div>
                  {/* Ensure Headers for new fields are present */}
                  <div className="sm:col-span-1 text-xs font-medium text-muted-foreground">Resist.</div>
                  <div className="sm:col-span-1 text-xs font-medium text-muted-foreground">Speed</div>
                  <div className="sm:col-span-1 text-xs font-medium text-muted-foreground">Incline</div>
              </div>
              {renderSetDetailRows(setDetails, handleSetDetailChange, fieldErrors.primary, 'primary')}
            </div>
          )}

          {/* Conditionally Rendered Alternative Set Detail Inputs */}
          {currentAltExerciseId && numSets > 0 && (
            <div className="mt-4 space-y-3 rounded border border-dashed border-border p-3">
             <h3 className="text-md font-medium text-muted-foreground mb-2">Alternative Exercise Details</h3>
             {error && sectionHasErrors('alternative') && <p className="mb-2 text-sm text-destructive">{error}</p>}
             <div className="grid grid-cols-1 gap-x-2 gap-y-2 sm:grid-cols-8 mb-1 pr-1">
                 <span className="font-medium sm:col-span-1 sm:text-right text-xs text-muted-foreground"></span>
                 <div className="sm:col-span-1 text-xs font-medium text-muted-foreground">Reps</div>
                 <div className="sm:col-span-1 text-xs font-medium text-muted-foreground">Weight</div>
                  <div className="sm:col-span-1 text-xs font-medium text-muted-foreground">Time</div>
                  <div className="sm:col-span-1 text-xs font-medium text-muted-foreground">Rest</div>
                  {/* Ensure Headers for new fields are present */}
                  <div className="sm:col-span-1 text-xs font-medium text-muted-foreground">Resist.</div>
                  <div className="sm:col-span-1 text-xs font-medium text-muted-foreground">Speed</div>
                  <div className="sm:col-span-1 text-xs font-medium text-muted-foreground">Incline</div>
              </div>
              {renderSetDetailRows(altSetDetails, handleAltSetDetailChange, fieldErrors.alternative, 'alternative')} {/* Corrected keyPrefix */}
            </div>
          )}

          {/* Conditionally Rendered Superset Detail Inputs */}
          {currentSupersetExerciseId && numSets > 0 && (
            <div className="mt-4 space-y-3 rounded border border-dotted border-border p-3">
             <h3 className="text-md font-medium text-muted-foreground mb-2">Superset Exercise Details</h3>
             {error && sectionHasErrors('superset') && <p className="mb-2 text-sm text-destructive">{error}</p>}
             <div className="grid grid-cols-1 gap-x-2 gap-y-2 sm:grid-cols-8 mb-1 pr-1">
                 <span className="font-medium sm:col-span-1 sm:text-right text-xs text-muted-foreground"></span>
                 <div className="sm:col-span-1 text-xs font-medium text-muted-foreground">Reps</div>
                 <div className="sm:col-span-1 text-xs font-medium text-muted-foreground">Weight</div>
                  <div className="sm:col-span-1 text-xs font-medium text-muted-foreground">Time</div>
                  <div className="sm:col-span-1 text-xs font-medium text-muted-foreground">Rest</div>
                  {/* Ensure Headers for new fields are present */}
                  <div className="sm:col-span-1 text-xs font-medium text-muted-foreground">Resist.</div>
                  <div className="sm:col-span-1 text-xs font-medium text-muted-foreground">Speed</div>
                  <div className="sm:col-span-1 text-xs font-medium text-muted-foreground">Incline</div>
              </div>
              {renderSetDetailRows(supersetSetDetails, handleSupersetSetDetailChange, fieldErrors.superset, 'superset')}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4">
             {/* Unsaved Changes Warning Area */}
             <div className="flex-grow mr-4">
                 {showUnsavedWarning && (
                     <p className="text-sm text-destructive">
                         Unsaved changes.{" "}
                         <button type="button" onClick={revertChanges} className="underline hover:text-destructive/80 focus:outline-none">
                             Revert?
                         </button>
                     </p>
                 )}
             </div>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground shadow-sm hover:bg-muted/50"
            >
              Cancel
            </button>
             <button
               type="button"
               onClick={handleClose}
               className="rounded-md border border-blue-500 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-600 shadow-sm hover:bg-blue-500/20"
             >
               Done
             </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
