"use client"; // Convert to Client Component

import Link from 'next/link';
import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation'; // Needed for Done button if not using Link
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from '@/components/ui/textarea';
import { addNutritionProgramTemplate } from '@/app/coach/actions'; // Import the server action
import { cn } from '@/lib/utils'; // For conditional classes

// Define categories (can be moved to a constants file later)
const programCategories = [
  "Weight Loss", "Weight Gain (Bulk)", "Weight Maintenance", "Body Building",
  "Fasting", "Vegetarian", "Vegan", "Ketogenic", "Paleo", "Low-Carb",
  "High-Protein", "Gluten-Free", "Diabetic-Friendly", "Sports Nutrition",
  "Other (Custom)"
];

// Define the structure for form data state
interface FormDataState {
  name: string;
  description: string;
  category: string;
  calorie_target_type: 'fixed' | 'deficit'; // Renamed
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
}

// Define the structure for edit state
interface EditState {
  name: boolean;
  description: boolean;
  category: boolean;
  // calorie_target_type is radio, always editable
  min_calories: boolean;
  max_calories: boolean;
  min_protein_grams: boolean;
  max_protein_grams: boolean;
  min_carb_grams: boolean;
  max_carb_grams: boolean;
  min_fat_grams: boolean;
  max_fat_grams: boolean;
  min_sugar_grams: boolean;
  max_sugar_grams: boolean;
}

const initialFormData: FormDataState = {
  name: '', description: '', category: '', calorie_target_type: 'fixed', // Renamed default
  min_calories: '', max_calories: '', min_protein_grams: '', max_protein_grams: '',
  min_carb_grams: '', max_carb_grams: '', min_fat_grams: '', max_fat_grams: '',
  min_sugar_grams: '', max_sugar_grams: ''
};

const initialEditState: EditState = {
  name: false, description: false, category: false, min_calories: false,
  max_calories: false, min_protein_grams: false, max_protein_grams: false,
  min_carb_grams: false, max_carb_grams: false, min_fat_grams: false,
  max_fat_grams: false, min_sugar_grams: false, max_sugar_grams: false
};

export default function AddNutritionProgramPage() {
  const [formData, setFormData] = useState<FormDataState>(initialFormData);
  const [editState, setEditState] = useState<EditState>(initialEditState);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter(); // For Done button alternative

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRadioChange = (value: string) => {
    setFormData(prev => ({ ...prev, calorie_target_type: value as 'fixed' | 'deficit' })); // Use 'fixed'
  };

  const toggleEdit = (field: keyof EditState) => {
    setEditState(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleBlur = (field: keyof EditState) => {
     // Optionally add validation or formatting here before saving
     setEditState(prev => ({ ...prev, [field]: false }));
  };

  const clearForm = () => {
    setFormData(initialFormData);
    setEditState(initialEditState);
    setMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // Prevent default form submission
    setMessage(null); // Clear previous messages

    // Construct FormData object from state
    const data = new FormData();
    // Append all fields, letting the server action handle null/empty strings if necessary
    Object.entries(formData).forEach(([key, value]) => {
        data.append(key, value);
    });
    // Ensure calorie_target_type is explicitly set (it has a default in state)
    data.set('calorie_target_type', formData.calorie_target_type);

    startTransition(async () => {
      const result = await addNutritionProgramTemplate(data);
      if (result.success) {
        setMessage({ type: 'success', text: result.message || 'Program created successfully!' });
        clearForm(); // Clear form for next entry
        // Optionally redirect after a delay or based on user action
        // router.push(`/coach/nutrition/programs/${result.data?.newTemplateId}/edit`);
      } else {
        setMessage({ type: 'error', text: result.error || 'An unknown error occurred.' });
      }
    });
  };

  // Helper to render static or input field
  const renderEditableField = (
      fieldKey: keyof FormDataState,
      label: string,
      placeholder: string,
      inputType: 'input' | 'textarea' | 'select' = 'input',
      inputProps: any = {} // Allow passing extra props like type="number"
  ) => {
      const isEditing = editState[fieldKey as keyof EditState];
      const value = formData[fieldKey];

      return (
          <div>
              <Label htmlFor={fieldKey} className="block text-sm font-medium text-foreground mb-1">{label}</Label>
              {isEditing ? (
                  inputType === 'textarea' ? (
                      <Textarea
                          id={fieldKey}
                          name={fieldKey}
                          value={value}
                          onChange={handleInputChange}
                          onBlur={() => handleBlur(fieldKey as keyof EditState)}
                          placeholder={placeholder}
                          className={cn("w-full", inputProps.className)} // Apply width/other classes
                          rows={3}
                          autoFocus
                          {...inputProps}
                      />
                  ) : inputType === 'select' ? (
                     <select
                        id={fieldKey}
                        name={fieldKey}
                        value={value}
                        onChange={handleInputChange}
                        onBlur={() => handleBlur(fieldKey as keyof EditState)}
                        className={cn("w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", inputProps.className)}
                        autoFocus
                        {...inputProps}
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
                          onChange={handleInputChange}
                          onBlur={() => handleBlur(fieldKey as keyof EditState)}
                          placeholder={placeholder}
                          className={cn("w-full", inputProps.className)} // Apply width/other classes
                          autoFocus
                          {...inputProps} // Spread remaining props like type, min, step
                      />
                  )
              ) : (
                  <div
                      onClick={() => toggleEdit(fieldKey as keyof EditState)}
                      className="w-full min-h-[40px] cursor-pointer rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground italic"
                  >
                      {value || placeholder}
                  </div>
              )}
          </div>
      );
  };


  return (
    <div className="container mx-auto p-8 max-w-2xl">
       <div className="flex justify-end items-center mb-4"> {/* Removed justify-between, only Done button */}
            {/* Removed Back link */}
            <Link href="/coach/nutrition/programs">
                 <Button variant="outline" size="sm">Done</Button>
            </Link>
       </div>

      <h1 className="text-3xl font-bold mb-6">Create New Nutrition Program</h1>

      {/* Display Success/Error Messages */}
      {message && (
        <div className={`mb-4 p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Remove action prop, use onSubmit */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {renderEditableField('name', 'Program Name', 'e.g., Summer Shred Plan', 'input', { required: true, className: "w-full" })}
        {renderEditableField('description', 'Description (Optional)', 'Briefly describe the goals...', 'textarea')}
        {renderEditableField('category', 'Category (Optional)', 'Select a category...', 'select')}


        {/* Nutritional Targets Section */}
        <div className="space-y-4 border-t pt-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Nutritional Targets (Optional)</h2>

          {/* Calorie Target Type - Always editable */}
          <div>
            <Label className="block text-sm font-medium text-foreground mb-2">Calorie Target Type</Label>
            <RadioGroup
                name="calorie_target_type"
                value={formData.calorie_target_type}
                onValueChange={handleRadioChange} // Use onValueChange for RadioGroup
                className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fixed" id="cal-fixed" />
                <Label htmlFor="cal-fixed">Set Fixed Calories</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="deficit" id="cal-deficit" />
                <Label htmlFor="cal-deficit">Set Calorie Deficit</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Min/Max Inputs */}
          {[
              { keyBase: 'calories', label: 'Calories' },
              { keyBase: 'protein_grams', label: 'Protein (g)' },
              { keyBase: 'carb_grams', label: 'Carbs (g)' },
              { keyBase: 'fat_grams', label: 'Fat (g)' },
              { keyBase: 'sugar_grams', label: 'Sugar (g)' }
          ].map(({ keyBase, label }) => (
            <div key={keyBase}>
              <Label className="block text-sm font-medium text-foreground mb-1">{label}</Label>
              <div className="flex space-x-4">
                {/* Min Field */}
                <div className="flex-1">
                   {renderEditableField(
                       `min_${keyBase}` as keyof FormDataState,
                       'Min', // Label handled above, pass empty or specific if needed
                       'e.g., 1800',
                       'input',
                       { type: 'number', min: "0", step: "any", className: "w-24" } // Resize width
                   )}
                </div>
                 {/* Max Field */}
                <div className="flex-1">
                   {renderEditableField(
                       `max_${keyBase}` as keyof FormDataState,
                        'Max', // Label handled above
                       'e.g., 2200',
                       'input',
                       { type: 'number', min: "0", step: "any", className: "w-24" } // Resize width
                   )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Form Actions */}
        <div className="flex justify-end pt-6 border-t space-x-3">
           <Button type="button" variant="outline" onClick={clearForm} disabled={isPending}>
                Clear Form
           </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Creating...' : 'Create Program'}
            {/* Changed button text as it no longer redirects immediately */}
          </Button>
        </div>
      </form>
    </div>
  );
}
