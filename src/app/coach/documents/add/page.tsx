import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import AuthMessages from '@/app/(auth)/AuthMessages'; // Re-use for displaying messages
import { addDocument } from '@/app/coach/actions'; // Import the action

export default async function AddDocumentPage({
  searchParams,
}: {
  searchParams: { message?: string; error?: string };
}) {
  const supabase = createClient();

  // Verify user is logged in and is a coach
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: coachProfile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !coachProfile || coachProfile.role !== 'coach') {
    redirect('/dashboard'); // Redirect non-coaches
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="mb-6 text-3xl font-bold">Create New Document Template</h1>

      <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-8 shadow-lg">
        <AuthMessages />

        <form className="space-y-6" action={addDocument} >
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-muted-foreground">
              Document Title (e.g., "Liability Waiver", "Training Contract")
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
              placeholder="Waiver Title"
            />
          </div>

           <div>
            <label htmlFor="content" className="block text-sm font-medium text-muted-foreground">
              Document Content (Paste or type the full text here)
            </label>
            <textarea
              id="content"
              name="content"
              required
              rows={15}
              className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm font-mono"
              placeholder="Enter the full text of your waiver or contract..."
            />
          </div>

           <div className="flex items-center">
             <input
               id="isActive"
               name="isActive"
               type="checkbox"
               defaultChecked={true}
               className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
             />
             <label htmlFor="isActive" className="ml-2 block text-sm text-muted-foreground">
               Set as active (clients will see this document if assigned)
             </label>
           </div>


          <div className="flex justify-end space-x-4 pt-4">
             <Link
               href="/coach/documents"
               className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground shadow-sm hover:bg-muted/50"
             >
               Cancel
             </Link>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
            >
              Create Document
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
