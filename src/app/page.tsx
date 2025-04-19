import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

// This page acts as the entry point and redirects based on auth status.
export default async function RootPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // If user is logged in, redirect to their dashboard
    redirect('/dashboard');
  } else {
    // If user is not logged in, redirect to the login page
    redirect('/login');
  }

  // This part should ideally not be reached due to redirects,
  // but returning null satisfies the component return type.
  return null;
}
