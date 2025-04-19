import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import AuthMessages from '@/app/(auth)/AuthMessages';
import { Database } from '@/lib/database.types';
import { assignNutritionProgram } from '@/app/coach/actions'; // Import the action

type ClientProfile = Database['public']['Tables']['profiles']['Row'];
type NutritionProgramTemplate = Database['public']['Tables']['nutrition_program_templates']['Row'];

export default async function AssignNutritionProgramPage() {
  const supabase = createClient();

  // Verify user and coach role
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: coachProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!coachProfile || coachProfile.role !== 'coach') redirect('/dashboard');

  // Fetch coach's clients
  const { data: clients, error: clientsError } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('coach_id', user.id)
    .eq('role', 'client')
    .order('full_name', { ascending: true });

  // Fetch coach's nutrition program templates
  const { data: templates, error: templatesError } = await supabase
    .from('nutrition_program_templates')
    .select('id, name')
    .eq('coach_id', user.id)
    .order('name', { ascending: true });

  if (clientsError || templatesError) {
    console.error('Error fetching data:', { clientsError, templatesError });
    // Handle error display appropriately, maybe redirect with an error message
  }

  return (
    <div className="container mx-auto max-w-2xl p-8">
      <Link href="/dashboard" className="text-sm text-primary hover:underline mb-4 inline-block">
        &larr; Back to Dashboard
      </Link>
      <h1 className="text-3xl font-bold mb-6">Assign Nutrition Program</h1>

      <AuthMessages />

      {(clientsError || templatesError) && (
        <p className="text-destructive mb-4">Error loading clients or program templates. Please try again later.</p>
      )}

      <form action={assignNutritionProgram} className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        {/* Client Selection */}
        <div>
          <Label htmlFor="clientId" className="block text-sm font-medium mb-1">Client</Label>
          <Select name="clientId" required>
            <SelectTrigger id="clientId">
              <SelectValue placeholder="Select a client..." />
            </SelectTrigger>
            <SelectContent>
              {!clients || clients.length === 0 ? (
                <SelectItem value="-" disabled>No clients found</SelectItem>
              ) : (
                clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.full_name} ({client.email})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {clients?.length === 0 && <p className="text-xs text-muted-foreground mt-1">You need to add clients first.</p>}
        </div>

        {/* Program Template Selection */}
        <div>
          <Label htmlFor="programTemplateId" className="block text-sm font-medium mb-1">Nutrition Program Template</Label>
          <Select name="programTemplateId" required>
            <SelectTrigger id="programTemplateId">
              <SelectValue placeholder="Select a program template..." />
            </SelectTrigger>
            <SelectContent>
              {!templates || templates.length === 0 ? (
                <SelectItem value="-" disabled>No templates found</SelectItem>
              ) : (
                templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
           {templates?.length === 0 && <p className="text-xs text-muted-foreground mt-1">You need to create nutrition program templates first.</p>}
        </div>

        {/* Start Date */}
        <div>
          <Label htmlFor="startDate" className="block text-sm font-medium mb-1">Start Date</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            required
            className="w-full"
            // Optionally set a default value or min date
            min={new Date().toISOString().split('T')[0]} // Prevent selecting past dates
          />
        </div>

        {/* TODO: Add optional End Date? Or calculate based on template duration? */}

        <div className="flex justify-end gap-3">
           <Button type="button" variant="outline" asChild>
              <Link href="/dashboard">Cancel</Link>
           </Button>
           <Button type="submit" disabled={!clients || clients.length === 0 || !templates || templates.length === 0}>
             Assign Program
           </Button>
        </div>
      </form>
    </div>
  );
}
