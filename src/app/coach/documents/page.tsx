import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';

// Define type for documents
type DocumentTemplate = {
  id: string;
  title: string;
  version: number;
  is_active: boolean;
  updated_at: string;
};

export default async function CoachDocumentsPage() {
  const supabase = createClient();

  // 1. Get current user & verify coach role
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: coachProfile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !coachProfile || coachProfile.role !== 'coach') {
    redirect('/dashboard');
  }

  // 2. Fetch document templates for this coach
  const { data: documents, error: documentsError } = await supabase
    .from('documents')
    .select('id, title, version, is_active, updated_at')
    .eq('coach_id', user.id)
    .order('title', { ascending: true })
    .order('version', { ascending: false }); // Show latest version first if titles match

  if (documentsError) {
    console.error('Error fetching documents:', documentsError);
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Document Templates</h1>
        <Link
          href="/coach/documents/add"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          Create New Document
        </Link>
      </div>

      {documentsError && (
        <p className="text-destructive">Error loading documents. Please try again.</p>
      )}

      {!documentsError && documents && documents.length === 0 && (
        <p className="text-muted-foreground">You haven't created any document templates yet.</p>
      )}

      {!documentsError && documents && documents.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Title</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Version</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Last Updated</th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {documents.map((doc: DocumentTemplate) => (
                <tr key={doc.id}>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-foreground">{doc.title}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">v{doc.version}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                     <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                       doc.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                     }`} >
                       {doc.is_active ? 'Active' : 'Inactive'}
                     </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                    {format(new Date(doc.updated_at), 'PPP p')}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                    {/* Add Edit/View actions later */}
                    <button disabled className="text-muted-foreground/50">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
       <div className="mt-6">
         <Link href="/dashboard" className="text-sm text-primary hover:underline">
           &larr; Back to Dashboard
         </Link>
       </div>
    </div>
  );
}
