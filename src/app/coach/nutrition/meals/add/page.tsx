import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea'; // Import Textarea
import AuthMessages from '@/app/(auth)/AuthMessages';
import { addMealTemplate } from '@/app/coach/actions'; // We will create this action next

export default async function AddMealPage() {
  const supabase = createClient();

  // Verify user and coach role
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: coachProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!coachProfile || coachProfile.role !== 'coach') redirect('/dashboard');

  return (
    <div className="container mx-auto max-w-2xl p-8">
      <Link href="/coach/nutrition/meals" className="text-sm text-primary hover:underline mb-4 inline-block">
        &larr; Back to Meal Templates
      </Link>
      <h1 className="text-3xl font-bold mb-6">Create New Meal Template</h1>

      <AuthMessages />

      <form action={addMealTemplate} className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div>
          <Label htmlFor="name" className="block text-sm font-medium mb-1">Meal Name</Label>
          <Input
            id="name"
            name="name"
            type="text"
            required
            placeholder="e.g., High-Protein Breakfast, Post-Workout Snack"
            className="w-full"
          />
          <p className="mt-1 text-xs text-muted-foreground">Give your meal template a unique and descriptive name.</p>
        </div>

        <div>
          <Label htmlFor="description" className="block text-sm font-medium mb-1">Description (Optional)</Label>
          <Textarea
            id="description"
            name="description"
            placeholder="Add any notes about this meal template..."
            className="w-full"
            rows={3}
          />
           <p className="mt-1 text-xs text-muted-foreground">Optional notes about the meal's purpose or preparation.</p>
        </div>

        <div className="flex justify-end gap-3">
           <Button type="button" variant="outline" asChild>
              <Link href="/coach/nutrition/meals">Cancel</Link>
           </Button>
           <Button type="submit">
             Create & Add Foods
           </Button>
        </div>
      </form>
    </div>
  );
}
