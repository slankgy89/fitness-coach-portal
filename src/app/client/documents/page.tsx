import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import AuthMessages from '@/app/(auth)/AuthMessages';
import { agreeToDocument } from '../actions'; // Import the action

// Define type for documents the client needs to see/agree to
type DocumentToSign = {
  id: string;
  title: string;
  version: number;
  content: string;
};

export default async function ClientDocumentsPage({
  searchParams,
}: {
  searchParams: { message?: string; error?: string };
}) {
  const supabase = createClient();

  // 1. Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 2. Get client's profile to find their coach_id
  const { data: clientProfile, error: profileError } = await supabase
    .from('profiles')
    .select('role, coach_id')
    .eq('id', user.id)
    .single();

  if (profileError || !clientProfile || clientProfile.role !== 'client') {
    redirect('/dashboard');
  }
  if (!clientProfile.coach_id) {
     return ( // Handle case where client has no coach
       <div className="container mx-auto p-8">
         <h1 className="mb-6 text-3xl font-bold">My Documents</h1>
         <p className="text-muted-foreground">You are not currently assigned to a coach.</p>
         <Link href="/dashboard" className="mt-6 inline-block text-sm text-primary hover:underline">&larr; Back to Dashboard</Link>
       </div>
     );
  }

  // 3. Fetch IDs and versions of documents already agreed to by this client
  const { data: agreedDocsData, error: agreedError } = await supabase
    .from('document_agreements')
    .select('document_id, document_version')
    .eq('client_id', user.id);

  if (agreedError) {
    console.error("Error fetching agreed documents:", agreedError);
    // Handle error appropriately
  }

  const agreedDocsMap = new Map(agreedDocsData?.map(a => [`${a.document_id}-${a.document_version}`, true]));

  // 4. Fetch active documents from the client's coach
  const { data: activeDocs, error: activeDocsError } = await supabase
    .from('documents')
    .select('id, title, version, content')
    .eq('coach_id', clientProfile.coach_id)
    .eq('is_active', true) // Only fetch active documents
    .order('title');

  if (activeDocsError) {
    console.error("Error fetching active documents:", activeDocsError);
  }

  // 5. Filter out documents the client has already agreed to
  const documentsToSign = activeDocs?.filter(doc => !agreedDocsMap.has(`${doc.id}-${doc.version}`)) ?? [];


  return (
    <div className="container mx-auto p-8">
      <h1 className="mb-6 text-3xl font-bold">My Documents</h1>
      <AuthMessages />

      {activeDocsError && (
        <p className="text-destructive">Error loading documents. Please try again.</p>
      )}

      {!activeDocsError && documentsToSign.length === 0 && (
        <p className="text-muted-foreground">No pending documents require your agreement.</p>
      )}

      {!activeDocsError && documentsToSign.length > 0 && (
        <div className="space-y-8">
          {documentsToSign.map((doc: DocumentToSign) => (
            <div key={doc.id} className="rounded-lg border border-border bg-card p-6 shadow-lg">
              <h2 className="mb-2 text-xl font-semibold">{doc.title} (v{doc.version})</h2>
              <div className="mb-4 h-64 overflow-y-auto rounded border border-input bg-background p-4 font-mono text-sm">
                <pre className="whitespace-pre-wrap">{doc.content}</pre>
              </div>
              <form action={agreeToDocument} >
                <input type="hidden" name="documentId" value={doc.id} />
                <input type="hidden" name="documentVersion" value={doc.version} />
                <div className="flex items-center">
                  <input
                    id={`agree-${doc.id}`}
                    name="agree"
                    type="checkbox"
                    required
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor={`agree-${doc.id}`} className="ml-2 block text-sm text-muted-foreground">
                    I have read and agree to the terms of this document.
                  </label>
                </div>
                <button
                  type="submit"
                  className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                >
                  Confirm Agreement
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

       <div className="mt-8">
         <Link href="/dashboard" className="text-sm text-primary hover:underline">
           &larr; Back to Dashboard
         </Link>
       </div>
    </div>
  );
}
