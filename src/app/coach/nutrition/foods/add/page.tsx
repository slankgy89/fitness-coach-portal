import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AuthMessages from '@/app/(auth)/AuthMessages';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { addManualFood } from '@/app/coach/actions'; // Import the action

export default async function AddFoodPage() {
  const supabase = createClient();

  // Verify user and coach role
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: coachProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!coachProfile || coachProfile.role !== 'coach') redirect('/dashboard');

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <Link href="/coach/nutrition/foods" className="text-sm text-primary hover:underline mb-4 block">
        &larr; Back to Nutrition Library
      </Link>
      <h1 className="text-3xl font-bold mb-6">Add New Food Item</h1>

      <AuthMessages />

      <form className="space-y-6" action={addManualFood}> {/* Use server action */}
        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Food Name *</Label>
            <Input id="name" name="name" type="text" required placeholder="e.g., Chicken Breast, Raw" />
          </div>
          <div>
            <Label htmlFor="brand_owner">Brand (Optional)</Label>
            <Input id="brand_owner" name="brand_owner" type="text" placeholder="e.g., Tyson" />
          </div>
        </div>

        {/* Serving Size */}
        <fieldset className="border p-4 rounded-md">
            <legend className="text-sm font-medium px-1">Serving Size *</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                 <div>
                    <Label htmlFor="serving_size_qty">Quantity *</Label>
                    <Input id="serving_size_qty" name="serving_size_qty" type="number" step="any" required placeholder="e.g., 100" />
                 </div>
                 <div>
                    <Label htmlFor="serving_size_unit">Unit *</Label>
                    <Input id="serving_size_unit" name="serving_size_unit" type="text" required placeholder="e.g., g, oz, cup, piece" />
                 </div>
            </div>
        </fieldset>

        {/* Macros */}
         <fieldset className="border p-4 rounded-md">
            <legend className="text-sm font-medium px-1">Macronutrients (per serving) *</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                 <div>
                    <Label htmlFor="calories">Calories *</Label>
                    <Input id="calories" name="calories" type="number" step="any" required placeholder="e.g., 165" />
                 </div>
                 <div>
                    <Label htmlFor="protein_g">Protein (g) *</Label>
                    <Input id="protein_g" name="protein_g" type="number" step="any" defaultValue="0" required />
                 </div>
                 <div>
                    <Label htmlFor="carbs_g">Carbs (g) *</Label>
                    <Input id="carbs_g" name="carbs_g" type="number" step="any" defaultValue="0" required />
                 </div>
                 <div>
                    <Label htmlFor="fat_g">Fat (g) *</Label>
                    <Input id="fat_g" name="fat_g" type="number" step="any" defaultValue="0" required />
                 </div>
            </div>
        </fieldset>

         {/* Optional Micronutrients */}
         <fieldset className="border p-4 rounded-md">
            <legend className="text-sm font-medium px-1">Optional Nutrients (per serving)</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                 <div>
                    <Label htmlFor="fiber_g">Fiber (g)</Label>
                    <Input id="fiber_g" name="fiber_g" type="number" step="any" placeholder="Optional" />
                 </div>
                 <div>
                    <Label htmlFor="sugar_g">Sugar (g)</Label>
                    <Input id="sugar_g" name="sugar_g" type="number" step="any" placeholder="Optional" />
                 </div>
                 <div>
                    <Label htmlFor="sodium_mg">Sodium (mg)</Label>
                    <Input id="sodium_mg" name="sodium_mg" type="number" step="any" placeholder="Optional" />
                 </div>
            </div>
        </fieldset>

        {/* Source Info (Hidden for manual add) */}
        <input type="hidden" name="source" value="manual" />

        <Button type="submit" className="w-full md:w-auto"> {/* Enabled button */}
          Add Food Item
        </Button>
      </form>
    </div>
  );
}
