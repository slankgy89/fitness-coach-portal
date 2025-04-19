'use client'; // This component handles the editing UI

import { useState, useTransition, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import {
  updateNutritionProgramTemplateDetails,
  type NutritionProgramTemplateUpdates
} from '@/app/coach/actions';
import { Edit, Loader2, AlertCircle, CheckCircle, Save } from 'lucide-react';
import Link from 'next/link';

// Expanded ProgramTemplate type
type ProgramTemplate = {
  id: string;
  coach_id: string;
  name: string;
  description: string | null;
  category: string | null;
  created_at: string;
  updated_at: string;
  calorie_target_type: 'fixed' | 'deficit' | null;
  min_calories: number | null;
  max_calories: number | null;
  min_protein_grams: number | null;
  max_protein_grams: number | null;
  min_carb_grams: number | null;
  max_carb_grams: number | null;
  min_fat_grams: number | null;
  max_fat_grams: number | null;
  min_sugar_grams: number | null;
  max_sugar_grams: number | null;
  target_meals_per_day: number | null;
  duration_value?: number | null;
  duration_unit?: 'days' | 'weeks' | 'months' | null;
  supplements?: any | null;
};

interface NutritionProgramEditorProps {
  program: ProgramTemplate;
  updateProgramDetailsAction: typeof updateNutritionProgramTemplateDetails;
}

type ActionResult = { success: boolean; error?: string; message?: string };

const programCategories = [
  "Weight Loss", "Weight Gain (Bulk)", "Weight Maintenance", "Body Building",
  "Fasting", "Vegetarian", "Vegan", "Ketogenic", "Paleo", "Low-Carb",
  "High-Protein", "Gluten-Free", "Diabetic-Friendly", "Sports Nutrition",
  "Other (Custom)"
];

type ProgramDetailsState = {
  name: string;
  description: string;
  category: string;
  calorie_target_type: 'fixed' | 'deficit';
  min_calories: string;
  max_calories: string;
  min_protein_grams: string;
  max_protein_grams: string;
  min_carb_grams: string;
  max_carb_grams: string;
  min_fat_grams: string;
  max_fat_grams: string;
  min_sugar_grams: string;
  max_sugar_grams: string;
  target_meals_per_day: string;
  duration_value: string;
  duration_unit: 'days' | 'weeks' | 'months' | '';
};

// Exclude duration_unit as it's handled by Select now
type ProgramEditState = {
    [K in keyof Omit<ProgramDetailsState, 'duration_unit'>]: boolean;
};

export function NutritionProgramEditor({
    program,
    updateProgramDetailsAction
}: NutritionProgramEditorProps) {
  const [isPending, startTransition] = useTransition();
  const [detailsActionResult, setDetailsActionResult] = useState<ActionResult | null>(null);

  const [programDetails, setProgramDetails] = useState<ProgramDetailsState>({
      name: program.name,
      description: program.description ?? '',
      category: program.category ?? '',
      calorie_target_type: program.calorie_target_type ?? 'fixed',
      min_calories: program.min_calories?.toString() ?? '',
      max_calories: program.max_calories?.toString() ?? '',
      min_protein_grams: program.min_protein_grams?.toString() ?? '',
      max_protein_grams: program.max_protein_grams?.toString() ?? '',
      min_carb_grams: program.min_carb_grams?.toString() ?? '',
      max_carb_grams: program.max_carb_grams?.toString() ?? '',
      min_fat_grams: program.min_fat_grams?.toString() ?? '',
      max_fat_grams: program.max_fat_grams?.toString() ?? '',
      min_sugar_grams: program.min_sugar_grams?.toString() ?? '',
      max_sugar_grams: program.max_sugar_grams?.toString() ?? '',
      target_meals_per_day: program.target_meals_per_day?.toString() ?? '',
      duration_value: program.duration_value?.toString() ?? '',
      duration_unit: (program.duration_unit ?? 'days') as ProgramDetailsState['duration_unit'],
  });

   const initialEditState = (Object.keys(programDetails) as Array<keyof ProgramDetailsState>).reduce((acc, key) => {
       if (key !== 'duration_unit') {
           acc[key as keyof ProgramEditState] = false;
       }
       return acc;
   }, {} as ProgramEditState);
   const [editState, setEditState] = useState<ProgramEditState>(initialEditState);

  const handleDurationUnitChange = (value: 'days' | 'weeks' | 'months' | '') => {
      setProgramDetails(prev => ({ ...prev, duration_unit: value }));
      handleSaveDetails('duration_unit', value);
  };

  useEffect(() => {
      const newDetails = {
          name: program.name,
          description: program.description ?? '',
          category: program.category ?? '',
          calorie_target_type: program.calorie_target_type ?? 'fixed',
          min_calories: program.min_calories?.toString() ?? '',
          max_calories: program.max_calories?.toString() ?? '',
          min_protein_grams: program.min_protein_grams?.toString() ?? '',
          max_protein_grams: program.max_protein_grams?.toString() ?? '',
          min_carb_grams: program.min_carb_grams?.toString() ?? '',
          max_carb_grams: program.max_carb_grams?.toString() ?? '',
          min_fat_grams: program.min_fat_grams?.toString() ?? '',
          max_fat_grams: program.max_fat_grams?.toString() ?? '',
          min_sugar_grams: program.min_sugar_grams?.toString() ?? '',
          max_sugar_grams: program.max_sugar_grams?.toString() ?? '',
          target_meals_per_day: program.target_meals_per_day?.toString() ?? '',
          duration_value: program.duration_value?.toString() ?? '',
          duration_unit: (program.duration_unit ?? 'days') as ProgramDetailsState['duration_unit'],
      };
       setProgramDetails(newDetails as ProgramDetailsState);
        const newInitialEditState = (Object.keys(newDetails) as Array<keyof ProgramDetailsState>).reduce((acc, key) => {
            if (key !== 'duration_unit') {
                acc[key as keyof ProgramEditState] = false;
            }
            return acc;
       }, {} as ProgramEditState);
      setEditState(newInitialEditState);
  }, [program]);

  const handleDetailChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setProgramDetails(prev => ({ ...prev, [name]: value }));
  };

  const handleDetailRadioChange = (value: string) => {
      const newValue = value as 'fixed' | 'deficit';
      setProgramDetails(prev => ({ ...prev, calorie_target_type: newValue }));
      handleSaveDetails('calorie_target_type', newValue);
  };

  const toggleDetailEdit = (field: keyof ProgramEditState) => {
      setEditState(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleDetailBlur = (field: keyof ProgramEditState) => {
      setEditState(prev => ({ ...prev, [field]: false }));
      handleSaveDetails(field);
  };

  const handleSaveDetails = (fieldToSave?: keyof ProgramDetailsState, directValue?: any) => {
      let finalData: NutritionProgramTemplateUpdates = {}; // Declare finalData at the top

      if (fieldToSave === 'calorie_target_type') {
          const validValue = directValue === 'fixed' || directValue === 'deficit' ? directValue : null;
          if (validValue && validValue !== program.calorie_target_type) {
              finalData = { calorie_target_type: validValue }; // ONLY include this field
          } else {
              console.log("No valid change detected for calorie_target_type");
              return; // Exit if no valid change
          }
      } else {
          // Process other fields only if it wasn't a calorie_target_type change
          const dataToSave: Partial<ProgramDetailsState> = {};
          let isDurationChange = false;

          if (fieldToSave) {
              const currentValue = directValue !== undefined ? directValue : programDetails[fieldToSave];
              const originalValue = (program as any)[fieldToSave as keyof ProgramTemplate];
              const originalValueStr = originalValue === null || originalValue === undefined ? '' : String(originalValue);

              if (fieldToSave === 'duration_unit') {
                  isDurationChange = true;
                  if (currentValue !== originalValueStr) {
                      dataToSave[fieldToSave] = currentValue;
                  }
                  const currentDurationValue = programDetails.duration_value;
                  const originalDurationValue = program.duration_value;
                  if (String(currentDurationValue ?? '') !== String(originalDurationValue ?? '')) {
                      dataToSave.duration_value = currentDurationValue;
                  } else if (dataToSave.duration_unit !== undefined) {
                      dataToSave.duration_value = currentDurationValue;
                  }
              } else if (fieldToSave === 'duration_value') {
                  isDurationChange = true;
                  const currentNum = currentValue === '' ? null : parseFloat(currentValue);
                  const originalNum = originalValue === null || originalValue === undefined ? null : parseFloat(String(originalValue));
                  if (currentNum !== originalNum) {
                      dataToSave[fieldToSave] = currentValue;
                      if (dataToSave.duration_unit === undefined) {
                          dataToSave.duration_unit = programDetails.duration_unit || 'days';
                      }
                  }
              } else if (String(currentValue ?? '') !== originalValueStr) {
                   dataToSave[fieldToSave] = currentValue;
              } else {
                  console.log("No change detected for", fieldToSave);
                  return;
              }
          } else {
              console.warn("Saving all details - implement if needed with a button");
              return;
          }

          if (isDurationChange && dataToSave.duration_unit === undefined && dataToSave.duration_value === undefined) {
              console.log("No change detected for duration unit or value");
              return;
          }

          if (Object.keys(dataToSave).length === 0) { return; }

          const numericKeys: (keyof ProgramDetailsState)[] = [
              'min_calories', 'max_calories', 'min_protein_grams', 'max_protein_grams',
              'min_carb_grams', 'max_carb_grams', 'min_fat_grams', 'max_fat_grams',
              'min_sugar_grams', 'max_sugar_grams', 'target_meals_per_day'
          ];

          // Build finalData from dataToSave for non-calorie_target_type changes
          Object.entries(dataToSave).forEach(([key, value]) => {
              const K = key as keyof ProgramDetailsState;

              if (K === 'duration_value') {
                  const strValue = value as string;
                  const parsed = strValue === null || strValue.trim() === '' ? null : parseInt(strValue, 10);
                  finalData.duration_value = (parsed !== null && !isNaN(parsed) && parsed >= 0) ? parsed : null;
                  if (finalData.duration_value === null) {
                      finalData.duration_unit = null;
                  } else if (dataToSave.duration_unit === undefined) {
                      finalData.duration_unit = programDetails.duration_unit || 'days';
                  }
              } else if (K === 'duration_unit') {
                  const unitValue = value === 'days' || value === 'weeks' || value === 'months' ? value : null;
                  finalData.duration_unit = unitValue;
                  if (finalData.duration_unit === null) {
                      finalData.duration_value = null;
                  } else if (finalData.duration_value === undefined) {
                      const currentDurationValue = programDetails.duration_value;
                      const parsed = currentDurationValue === null || currentDurationValue.trim() === '' ? null : parseInt(currentDurationValue, 10);
                      finalData.duration_value = (parsed !== null && !isNaN(parsed) && parsed >= 0) ? parsed : null;
                      if (finalData.duration_value === null) finalData.duration_unit = null;
                  }
              } else if (numericKeys.includes(K)) {
                  const strValue = value as string;
                  if (strValue === null || strValue.trim() === '') {
                      finalData[K as keyof NutritionProgramTemplateUpdates] = null;
                  } else {
                      const parsed = parseFloat(strValue);
                      finalData[K as keyof NutritionProgramTemplateUpdates] = ((isNaN(parsed) || parsed < 0) ? null : parsed) as any;
                  }
              } else if (K === 'description' || K === 'category' || K === 'name') {
                  finalData[K] = value === '' ? null : value as string | null;
              }
              // calorie_target_type is handled separately
          });
      }

      // Final check if finalData is empty before proceeding
      if (Object.keys(finalData).length === 0) {
          console.log("No valid changes to save after processing.");
          return;
      }

      const checkMinMax = (minKey: keyof NutritionProgramTemplateUpdates, maxKey: keyof NutritionProgramTemplateUpdates, name: string) => {
        const originalMin = program[minKey] ?? null;
        const originalMax = program[maxKey] ?? null;
        const minVal = finalData[minKey] !== undefined ? finalData[minKey] : originalMin;
        const maxVal = finalData[maxKey] !== undefined ? finalData[maxKey] : originalMax;

         if (minVal !== null && maxVal !== null && minVal > maxVal) {
             setDetailsActionResult({ success: false, error: `Min ${name} cannot be greater than max ${name}.` });
             return false;
         }
         return true;
     };

      if (!checkMinMax('min_calories', 'max_calories', 'calories')) return;
      if (!checkMinMax('min_protein_grams', 'max_protein_grams', 'protein')) return;
      if (!checkMinMax('min_carb_grams', 'max_carb_grams', 'carbs')) return;
      if (!checkMinMax('min_fat_grams', 'max_fat_grams', 'fat')) return;
      if (!checkMinMax('min_sugar_grams', 'max_sugar_grams', 'sugar')) return;

      console.log("Attempting to save:", finalData);

      startTransition(async () => {
          setDetailsActionResult(null);
          const result = await updateProgramDetailsAction(program.id, finalData);
          console.log("Save result:", result);
          setDetailsActionResult(result);
          if (!result.success) {
              console.error("Failed to save:", result.error);
              // Revert the specific field(s) on error
              if (fieldToSave === 'duration_unit' || fieldToSave === 'duration_value') {
                  setProgramDetails(prev => ({
                      ...prev,
                      duration_value: program.duration_value?.toString() ?? '',
                      duration_unit: (program.duration_unit ?? 'days') as ProgramDetailsState['duration_unit']
                  }));
              } else if (fieldToSave) {
                   setProgramDetails(prev => ({
                       ...prev,
                       [fieldToSave]: program[fieldToSave as keyof ProgramTemplate]?.toString() ?? ''
                   }));
              }
          }
      });
  };

  const renderEditableDetail = (
      fieldKey: keyof ProgramEditState,
      label: string,
      placeholder: string,
      inputType: 'input' | 'textarea' | 'select' = 'input',
      inputProps: any = {}
  ) => {
      const isEditing = editState[fieldKey];
      const value = programDetails[fieldKey as keyof ProgramDetailsState] ?? '';
      const { containerClassName, ...restInputProps } = inputProps; // Separate container class

      return (
          <div className={cn(containerClassName)}> {/* Apply container class here */}
              {/* Conditionally render label only if it's not Min/Max for targets */}
              {!(label === 'Min' || label === 'Max') && (
                <Label htmlFor={fieldKey} className="block text-sm font-medium text-foreground mb-1">{label}</Label>
              )}
              {isEditing ? (
                   inputType === 'textarea' ? (
                      <Textarea
                          id={fieldKey}
                          name={fieldKey}
                          value={value as string}
                          onChange={handleDetailChange}
                          onBlur={() => handleDetailBlur(fieldKey)}
                          placeholder={placeholder}
                          className={cn("w-full", restInputProps.className)}
                          rows={3}
                          autoFocus
                          {...restInputProps}
                      />
                  ) : inputType === 'select' ? (
                     <select
                        id={fieldKey}
                        name={fieldKey}
                        value={value as string}
                        onChange={handleDetailChange}
                        onBlur={() => handleDetailBlur(fieldKey)}
                        className={cn("w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", restInputProps.className)}
                        autoFocus
                        {...restInputProps}
                      >
                        <option value="">{placeholder}</option>
                        {programCategories.map(category => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                  ) : (
                      <Input
                          id={fieldKey}
                          name={fieldKey}
                          value={value}
                          onChange={handleDetailChange}
                          onBlur={() => handleDetailBlur(fieldKey)}
                          placeholder={placeholder}
                          className={cn("w-full", restInputProps.className)}
                          autoFocus
                          {...restInputProps}
                      />
                  )
              ) : (
                  <div
                      onClick={() => toggleDetailEdit(fieldKey)}
                      className={cn(
                          "w-full min-h-[40px] cursor-pointer rounded-md border border-transparent hover:border-input px-3 py-2 text-sm",
                          !value && "text-muted-foreground italic"
                      )}
                  >
                      {value || placeholder}
                  </div>
              )}
          </div>
      );
  };

  // --- Render ---
  return (
    <div className="space-y-6">
        {/* Program Details Section */}
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 space-y-4">
            {/* Header with Title and Duration Fields */}
            <div className="flex flex-wrap justify-between items-baseline mb-4 gap-4"> {/* Use items-baseline */}
                <h2 className="text-xl font-semibold flex-grow">Program Details</h2>
                {/* Duration Value & Unit - Moved to Header, side-by-side */}
                <div className="flex items-center space-x-2 flex-shrink-0"> {/* Use items-center */}
                    <Label htmlFor="duration_value" className="text-sm font-medium text-foreground whitespace-nowrap mr-1">Duration:</Label>
                    {renderEditableDetail(
                        'duration_value',
                        '', // Label provided above
                        'Value',
                        'input',
                        { type: 'number', min: "1", step: "1", placeholder: "Value", className: "w-16" } // Use w-16
                    )}
                    <Select
                        name="duration_unit"
                        value={programDetails.duration_unit || ''}
                        onValueChange={handleDurationUnitChange}
                        disabled={isPending}
                    >
                        <SelectTrigger id="duration_unit" className="w-[100px]">
                            <SelectValue placeholder="Unit" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="days">Days</SelectItem>
                            <SelectItem value="weeks">Weeks</SelectItem>
                            <SelectItem value="months">Months</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
             {detailsActionResult && (
                 <div className={`mb-4 p-3 rounded-md text-sm ${detailsActionResult.success ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-destructive/10 text-destructive border border-destructive/30'}`}>
                     {detailsActionResult.message || detailsActionResult.error}
                 </div>
             )}
            {/* Main Details */}
            {renderEditableDetail('name', 'Program Name', '[Click to add Name]', 'input', { required: true, className: "text-lg font-semibold" })}
            {renderEditableDetail('description', 'Description', '[Click to add Description]', 'textarea')}
            {renderEditableDetail('category', 'Category', 'Select a category...', 'select')}
            {renderEditableDetail(
                'target_meals_per_day',
                'Target Meals Per Day',
                '[Click to set Target Meals]',
                'input',
                { type: 'number', min: "0", step: "1", className: "w-16" } // Use w-16
            )}
        </div>

        {/* Nutritional Targets Section */}
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 space-y-4">
            <h3 className="text-lg font-semibold mb-4">Nutritional Targets</h3>
            {/* Calorie Target Type */}
            <div>
                <Label className="block text-sm font-medium text-foreground mb-2">Calorie Target Type</Label>
                <RadioGroup
                    name="calorie_target_type"
                    value={programDetails.calorie_target_type}
                    onValueChange={handleDetailRadioChange}
                    className="flex rounded-md border border-input bg-transparent" // Keep border for container
                >
                    <div className="flex-1">
                        <RadioGroupItem value="fixed" id="edit-cal-fixed" className="sr-only" />
                        <Label
                            htmlFor="edit-cal-fixed"
                            className={cn(
                                "block w-full cursor-pointer rounded-l-md p-2 text-center text-sm font-medium transition-colors", // Adjusted padding
                                "border border-input", // Add base border
                                programDetails.calorie_target_type === 'fixed'
                                    ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary ring-offset-2" // Style selected
                                    : "bg-background hover:bg-muted" // Style unselected
                            )}
                        >
                            Set Fixed Calories
                        </Label>
                    </div>
                    <div className="flex-1">
                        <RadioGroupItem value="deficit" id="edit-cal-deficit" className="sr-only" />
                        <Label
                            htmlFor="edit-cal-deficit"
                            className={cn(
                                "block w-full cursor-pointer rounded-r-md p-2 text-center text-sm font-medium transition-colors", // Adjusted padding
                                "border border-input border-l-0", // Add base border, remove left
                                programDetails.calorie_target_type === 'deficit'
                                    ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary ring-offset-2" // Style selected
                                    : "bg-background hover:bg-muted" // Style unselected
                            )}
                        >
                            Set Calorie Deficit
                        </Label>
                    </div>
                </RadioGroup>
            </div>
            {/* Nutrient Min/Max Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"> {/* Grid for overall targets */}
                {[
                    { keyBase: 'calories', label: 'Calories' },
                    { keyBase: 'protein_grams', label: 'Protein (g)' },
                    { keyBase: 'carb_grams', label: 'Carbs (g)' },
                    { keyBase: 'fat_grams', label: 'Fat (g)' },
                    { keyBase: 'sugar_grams', label: 'Sugar (g)' }
                ].map(({ keyBase, label }) => (
                    <div key={keyBase}>
                        <Label className="block text-sm font-medium text-foreground mb-1">{label}</Label>
                        {/* Compact Side-by-Side Min/Max */}
                        <div className="flex items-center space-x-2">
                            {renderEditableDetail(
                                `min_${keyBase}` as keyof ProgramEditState,
                                'Min', // Label hidden by renderEditableDetail
                                '[Min]',
                                'input',
                                { type: 'number', min: "0", step: "any", placeholder: "Min", className: "w-16", containerClassName: "flex-1" } // Use w-16
                            )}
                            <span className="text-muted-foreground">-</span>
                            {renderEditableDetail(
                                `max_${keyBase}` as keyof ProgramEditState,
                                'Max', // Label hidden by renderEditableDetail
                                '[Max]',
                                'input',
                                { type: 'number', min: "0", step: "any", placeholder: "Max", className: "w-16", containerClassName: "flex-1" } // Use w-16
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Link to Structure Editor Page */}
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-3">Program Structure</h2>
            <p className="text-sm text-muted-foreground mb-3">
                Manage the daily meals and food items for this program template.
            </p>
            <Link href={`/coach/nutrition/programs/${program.id}/structure`}>
                <Button variant="outline">
                    <Edit className="mr-2 h-4 w-4" /> Edit Meals & Items
                </Button>
            </Link>
        </div>
    </div>
  );
}
