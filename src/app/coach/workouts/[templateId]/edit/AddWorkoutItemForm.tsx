'use client';

import { useState, useTransition, ChangeEvent, FormEvent, useEffect } from 'react';
import { addWorkoutItem } from '@/app/coach/actions';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Button } from '@/components/ui/button'; // Assuming Button is needed here too

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

interface AddWorkoutItemFormProps {
  templateId: string;
  exercises: Exercise[];
}

// Helper
const getUniqueValues = (items: any[], key: string): string[] => {
  const validItems = items.map(item => item[key]).filter(value => value != null);
  return Array.from(new Set(validItems)).sort();
};

// Regex
const weightRegex = /^(|\d+(\.\d+)?\s*(kg|lbs|bw)?)$/i;
const timeRegex = /^(|\d+\s*(sec|min|hr)?)$/i;
const repsRegex = /^(|\d+(-\d+)?|amrap)$/i;
const resistanceRegex = /^(|Lvl\s*\d+|Small|Medium|Large|Ex\.?\s*Large)$/i;
const speedRegex = /^(|\d+(\.\d+)?\s*(Mph|Kmph)?)$/i;
const inclineRegex = /^(|Lvl\s*\d+|\d+(\.\d+)?\s*%?)$/i;

export default function AddWorkoutItemForm({ templateId, exercises }: AddWorkoutItemFormProps) {
  const [isPending, startTransition] = useTransition();
  const [numSets, setNumSets] = useState<number>(3);
  // Update initialSetDetail to initialize new fields correctly
  const initialSetDetail = (): Omit<SetDetail, 'set'> => ({ reps: '', weight: '', time: '', rest: '', resistance: null, speed: null, incline: null });

  // Initialize state using the updated initialSetDetail function and default numSets
  const [setDetails, setSetDetails] = useState<SetDetail[]>(() => Array.from({ length: 3 }, (_, i) => ({ set: i + 1, ...initialSetDetail() })));
  const [altSetDetails, setAltSetDetails] = useState<SetDetail[]>(() => Array.from({ length: 3 }, (_, i) => ({ set: i + 1, ...initialSetDetail() })));
  const [supersetSetDetails, setSupersetSetDetails] = useState<SetDetail[]>(() => Array.from({ length: 3 }, (_, i) => ({ set: i + 1, ...initialSetDetail() })));

  const [selectedAltExerciseId, setSelectedAltExerciseId] = useState<string>('');
  const [selectedSupersetExerciseId, setSelectedSupersetExerciseId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ primary: FieldErrors, alternative: FieldErrors, superset: FieldErrors }>({ primary: {}, alternative: {}, superset: {} });

  // Filtering State
  const [filterBodyPart, setFilterBodyPart] = useState<string>('');
  const [filterMachineType, setFilterMachineType] = useState<string>('');
  const [filterExerciseType, setFilterExerciseType] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Derive filter options and filtered exercises
  const bodyPartOptions = getUniqueValues(exercises, 'body_part');
  const machineTypeOptions = getUniqueValues(exercises, 'machine_type');
  const exerciseTypeOptions = getUniqueValues(exercises, 'exercise_type');

  const filteredExercises = exercises.filter(ex =>
    (filterBodyPart === '' || ex.body_part === filterBodyPart) &&
    (filterMachineType === '' || ex.machine_type === filterMachineType) &&
    (filterExerciseType === '' || ex.exercise_type === filterExerciseType) &&
    (searchTerm === '' || ex.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Sync number of sets
  useEffect(() => {
    const syncSets = (currentDetails: SetDetail[]): SetDetail[] => {
        const newDetails: SetDetail[] = [];
        for (let i = 0; i < numSets; i++) {
            newDetails.push(currentDetails[i] || { set: i + 1, ...initialSetDetail() });
        }
        return newDetails.slice(0, numSets).map((detail, index) => ({ ...detail, set: index + 1 }));
    };
    setSetDetails(current => syncSets(current));
    setAltSetDetails(current => syncSets(current));
    setSupersetSetDetails(current => syncSets(current));
  }, [numSets]);

  // Handlers
  const handleNumSetsChange = (e: ChangeEvent<HTMLInputElement>) => {
    const count = parseInt(e.target.value, 10) || 0;
    setNumSets(Math.max(0, Math.min(count, 20)));
  };

  const makeHandleDetailChange = (
      setter: React.Dispatch<React.SetStateAction<SetDetail[]>>,
      section: 'primary' | 'alternative' | 'superset'
  ) => (index: number, field: keyof Omit<SetDetail, 'set'>, value: string) => {
      // Clear the specific field error when user starts typing
      setFieldErrors(prev => ({
          ...prev,
          [section]: {
              ...prev[section],
              [index]: {
                  ...prev[section]?.[index],
                  [field]: undefined // Clear error for this field
              }
          }
      }));
      // Update the actual value
      setter(currentDetails =>
          currentDetails.map((detail, i) =>
              i === index ? { ...detail, [field]: value } : detail
          )
      );
  };

  const handleSetDetailChange = makeHandleDetailChange(setSetDetails, 'primary');
  const handleAltSetDetailChange = makeHandleDetailChange(setAltSetDetails, 'alternative');
  const handleSupersetSetDetailChange = makeHandleDetailChange(setSupersetSetDetails, 'superset');

  // Validation
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
           const newSetErrors = { ...newSectionErrors[index] };

           if (errorMsg) {
               newSetErrors[field] = errorMsg;
           } else {
               delete newSetErrors[field]; // Clear error if valid
           }

           if (Object.keys(newSetErrors).length === 0) {
               delete newSectionErrors[index]; // Remove entry for set if no errors
           } else {
               newSectionErrors[index] = newSetErrors;
           }

           return { ...prev, [section]: newSectionErrors };
       });
   };


   const validateAllSetDetails = (): boolean => {
      let hasErrors = false;
      const newFieldErrors: { primary: FieldErrors, alternative: FieldErrors, superset: FieldErrors } = { primary: {}, alternative: {}, superset: {} };

      newFieldErrors.primary = validateSetDetails(setDetails);
      if (Object.keys(newFieldErrors.primary).length > 0) hasErrors = true;

      if (selectedAltExerciseId) {
          newFieldErrors.alternative = validateSetDetails(altSetDetails);
          if (Object.keys(newFieldErrors.alternative).length > 0) hasErrors = true;
      }
      if (selectedSupersetExerciseId) {
          newFieldErrors.superset = validateSetDetails(supersetSetDetails);
          if (Object.keys(newFieldErrors.superset).length > 0) hasErrors = true;
      }

      setFieldErrors(newFieldErrors);
      return !hasErrors;
  };

  // Clear Form
  const handleClear = () => {
      const defaultNumSets = 3;
      setNumSets(defaultNumSets);
      const initialDetails = Array.from({ length: defaultNumSets }, (_, i) => ({ set: i + 1, ...initialSetDetail() }));
      setSetDetails(initialDetails);
      setAltSetDetails(initialDetails);
      setSupersetSetDetails(initialDetails);
      setSearchTerm('');
      setFilterBodyPart('');
      setFilterMachineType('');
      setFilterExerciseType('');
      setSelectedAltExerciseId('');
      setSelectedSupersetExerciseId('');
      setError(null);
      setFieldErrors({ primary: {}, alternative: {}, superset: {} });
      const form = document.getElementById('add-workout-item-form') as HTMLFormElement;
      if (form) {
          form.reset();
          // Need to explicitly reset state for controlled select components after form.reset()
          setSelectedAltExerciseId('');
          setSelectedSupersetExerciseId('');
      }
  };

  // Submit Handler
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({ primary: {}, alternative: {}, superset: {} });

    const isValid = validateAllSetDetails();
    if (!isValid) {
        setError("Please fix the errors highlighted below.");
        return;
    }

    const formData = new FormData(event.currentTarget);
    const exerciseId = formData.get('exerciseId') as string;
    const alternativeExerciseId = selectedAltExerciseId || null; // Use state value
    const supersetExerciseId = selectedSupersetExerciseId || null; // Use state value
    const notes = formData.get('notes') as string | null;

    if (!exerciseId) {
        setError("Please select an exercise.");
        return;
    }
    if (numSets <= 0) {
        setError("Number of sets must be greater than 0.");
        return;
    }

    const setDetailsPayload = JSON.stringify(setDetails.map(d => ({...d, resistance: d.resistance?.trim(), speed: d.speed?.trim(), incline: d.incline?.trim()})));
    const altSetDetailsPayload = alternativeExerciseId ? JSON.stringify(altSetDetails.map(d => ({...d, resistance: d.resistance?.trim(), speed: d.speed?.trim(), incline: d.incline?.trim()}))) : null;
    const supersetSetDetailsPayload = supersetExerciseId ? JSON.stringify(supersetSetDetails.map(d => ({...d, resistance: d.resistance?.trim(), speed: d.speed?.trim(), incline: d.incline?.trim()}))) : null;

    const actionFormData = new FormData();
    actionFormData.append('templateId', templateId);
    actionFormData.append('exerciseId', exerciseId);
    if (alternativeExerciseId) actionFormData.append('alternativeExerciseId', alternativeExerciseId);
    if (supersetExerciseId) actionFormData.append('supersetExerciseId', supersetExerciseId);
    actionFormData.append('sets', String(numSets));
    actionFormData.append('set_details', setDetailsPayload);
    if (altSetDetailsPayload) actionFormData.append('alt_set_details', altSetDetailsPayload);
    if (supersetSetDetailsPayload) actionFormData.append('superset_set_details', supersetSetDetailsPayload);
    if (notes) actionFormData.append('notes', notes);

    startTransition(async () => { // Make async to potentially handle result
      try {
        // Call the action
        const result = await addWorkoutItem(actionFormData);
        // Since addWorkoutItem redirects on success/error, we might not reach here
        // If it were changed to return ActionResult, we could handle it:
        // if (result.success) { handleClear(); /* Show success message */ }
        // else { setError(result.error || 'Failed to add item.'); }
      } catch (e) {
        console.error("Add item action failed:", e);
        setError(`Failed to add exercise item: ${e instanceof Error ? e.message : String(e)}`);
      }
    });
  };

  // Helper to check if a specific section has errors
  const sectionHasErrors = (section: 'primary' | 'alternative' | 'superset'): boolean => {
      return Object.values(fieldErrors[section]).some(set => Object.keys(set).length > 0);
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
                  {Object.keys(initialSetDetail()).map((field) => (
                      <div key={field} className="sm:col-span-1">
                          <Tooltip>
                              <TooltipTrigger asChild>
                                  <input
                                      type="text"
                                      placeholder={`e.g. ${field === 'reps' ? '8-12' : field === 'weight' ? '50 kg' : field === 'time' || field === 'rest' ? '60 sec' : field === 'resistance' ? 'Lvl 5' : field === 'speed' ? '10kph' : '5%'}`}
                                      value={(detail as any)[field] ?? ''}
                                      onChange={(e) => handler(index, field as keyof Omit<SetDetail, 'set'>, e.target.value)}
                                      onBlur={(e) => validateSingleField(
                                          keyPrefix as 'primary' | 'alternative' | 'superset', // Cast keyPrefix
                                          index,
                                          field as keyof Omit<SetDetail, 'set'>,
                                          e.target.value
                                      )}
                                      className={cn(
                                          "block w-full rounded-md border-input bg-background px-2 py-1 text-sm placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary",
                                          // Apply red background and border on error
                                          errorSection?.[index]?.[field as keyof Omit<SetDetail, 'set'>] && "border-destructive bg-destructive/20 focus:ring-destructive"
                                      )}
                                  />
                              </TooltipTrigger>
                              {errorSection?.[index]?.[field as keyof Omit<SetDetail, 'set'>] && (
                                  <TooltipContent side="top" className="bg-destructive text-destructive-foreground text-xs p-1">
                                      <p>{errorSection[index]?.[field as keyof Omit<SetDetail, 'set'>]}</p>
                                  </TooltipContent>
                              )}
                          </Tooltip>
                      </div>
                  ))}
              </div>
          ))}
      </TooltipProvider>
  );

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-lg">
      <h2 className="mb-4 text-xl font-semibold">Add Exercise</h2>

      {/* Filtering UI */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <input
          type="text"
          placeholder="Search exercise..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="block w-full rounded-md border-input bg-background px-3 py-2 placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
        />
        <select
          value={filterBodyPart}
          onChange={(e) => setFilterBodyPart(e.target.value)}
          className="block w-full rounded-md border-input bg-background px-3 py-2 text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
        >
          <option value="">All Body Parts</option>
          {bodyPartOptions.map(part => <option key={part} value={part}>{part}</option>)}
        </select>
        <select
          value={filterMachineType}
          onChange={(e) => setFilterMachineType(e.target.value)}
          className="block w-full rounded-md border-input bg-background px-3 py-2 text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
        >
          <option value="">All Equipment</option>
          {machineTypeOptions.map(type => <option key={type} value={type}>{type}</option>)}
        </select>
         <select
           value={filterExerciseType}
           onChange={(e) => setFilterExerciseType(e.target.value)}
           className="block w-full rounded-md border-input bg-background px-3 py-2 text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
         >
           <option value="">All Exercise Types</option>
           {exerciseTypeOptions.map(type => <option key={type} value={type}>{type}</option>)}
         </select>
      </div>

      {/* Form */}
      <form className="space-y-4" onSubmit={handleSubmit} id="add-workout-item-form">
        {/* Exercise Selection */}
        <div>
          <label htmlFor="exerciseId" className="block text-sm font-medium text-muted-foreground">Exercise</label>
          <select
            name="exerciseId"
            id="exerciseId"
            required
            // Use state for controlled component
            // value={selectedExerciseId}
            // onChange={(e) => setSelectedExerciseId(e.target.value)}
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
          <label htmlFor="alternativeExerciseId" className="block text-sm font-medium text-muted-foreground">Alternative Exercise (Optional)</label>
          <select
            id="alternativeExerciseId"
            value={selectedAltExerciseId}
            onChange={(e) => setSelectedAltExerciseId(e.target.value)}
            className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
          >
            <option value="">-- No Alternative --</option>
            {exercises.map(ex => (
              <option key={ex.id} value={ex.id}>{ex.name}</option>
            ))}
          </select>
        </div>

         {/* Superset Exercise */}
         <div>
           <label htmlFor="supersetExerciseId" className="block text-sm font-medium text-muted-foreground">Superset Exercise (Optional)</label>
           <select
             id="supersetExerciseId"
             value={selectedSupersetExerciseId}
             onChange={(e) => setSelectedSupersetExerciseId(e.target.value)}
             className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
           >
             <option value="">-- No Superset --</option>
             {exercises.map(ex => (
               <option key={ex.id} value={ex.id}>{ex.name}</option>
             ))}
           </select>
         </div>

        {/* Notes Field */}
        <div>
            <label htmlFor="notes" className="block text-sm font-medium text-muted-foreground">Notes (Optional)</label>
            <textarea
                id="notes"
                name="notes"
                rows={2}
                // Use state for controlled component
                // value={notesValue}
                // onChange={(e) => setNotesValue(e.target.value)}
                className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                placeholder="Add any specific notes for this exercise..."
            />
        </div>

        {/* Number of Sets Input */}
        <div>
          <label htmlFor="numSets" className="block text-sm font-medium text-muted-foreground">Number of Sets</label>
          <input
            type="number"
            id="numSets"
            name="sets" // Name should match FormData key expected by action
            value={numSets}
            onChange={handleNumSetsChange}
            min="1"
            max="20"
            required
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
        {selectedAltExerciseId && numSets > 0 && (
         <div className="mt-4 space-y-3 rounded border border-dashed border-border p-3">
             <h3 className="text-md font-medium text-muted-foreground mb-2">Alternative Exercise Details</h3>
             {error && sectionHasErrors('alternative') && <p className="mb-2 text-sm text-destructive">{error}</p>}
             <div className="grid grid-cols-1 gap-x-2 gap-y-2 sm:grid-cols-8 mb-1 pr-1">
                 <span className="font-medium sm:col-span-1 sm:text-right text-xs text-muted-foreground"></span>
                 <div className="sm:col-span-1 text-xs font-medium text-muted-foreground">Reps</div>

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
        {selectedSupersetExerciseId && numSets > 0 && (
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

        <div className="flex items-center space-x-3 pt-2"> {/* Container for buttons */}
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? 'Adding...' : 'Add to Workout'}
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={isPending}
              className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground shadow-sm hover:bg-muted/50 disabled:opacity-50"
            >
              Clear
            </button>
        </div>
      </form>
    </div>
  );
}
