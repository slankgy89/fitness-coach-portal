'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers'; // Import headers

export async function login(formData: FormData) {
  const supabase = createClient();

  // Type-safe access to form data
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    redirectTo: formData.get('redirect_to') as string | undefined, // Get redirect path
  };

  const { error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });

  if (error) {
    console.error('Login error:', error.message);
    return redirect('/login?error=Could not authenticate user');
  }

  revalidatePath('/', 'layout');
  console.log(`[Login Action] redirectTo from form: ${data.redirectTo}`);
  redirect(data.redirectTo || '/dashboard');
}

export async function signup(formData: FormData) {
  const supabase = createClient();
  // Removed headers() call for now to avoid TS errors


  const data = {
    firstName: formData.get('firstName') as string,
    lastName: formData.get('lastName') as string,
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    role: formData.get('role') as string,
    priceId: formData.get('priceId') as string | undefined,
    coachSearchId: formData.get('coachSearchId') as string | undefined,
  };

  let coachUuid: string | null = null;

  // --- Find Coach UUID from Search ID (if provided and role is client) ---
  if (data.role === 'client' && data.coachSearchId && data.coachSearchId.trim() !== '') {
    const searchId = data.coachSearchId.trim().toUpperCase(); // Normalize search ID
    console.log(`[Signup Action] Client provided Coach Search ID: ${searchId}`);
    const { data: coachProfile, error: coachError } = await supabase
      .from('profiles')
      .select('id')
      .eq('coach_search_id', searchId)
      .eq('role', 'coach')
      .single();

    if (coachError || !coachProfile) {
      console.error(`[Signup Action] Invalid or non-existent Coach Search ID: ${searchId}`, coachError);
      // Redirect back to signup page with error
      let redirectPath = '/signup?error=Invalid+Coach+ID+provided';
      if (data.priceId) redirectPath += `&priceId=${data.priceId}`;
      return redirect(redirectPath);
    }

    coachUuid = coachProfile.id;
    console.log(`[Signup Action] Found Coach UUID: ${coachUuid} for Search ID: ${searchId}`);
  } else if (data.role === 'client') {
     console.log(`[Signup Action] No Coach Search ID provided by client. Default will be assigned by trigger.`);
     // coachUuid remains null, trigger will handle default assignment
  }
  // --- End Find Coach UUID ---

  // Prepare signup options with metadata
  const signUpOptions: { email: string; password: string; options?: any } = {
    email: data.email,
    password: data.password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`, // Optional: if email confirmation is needed
      data: { // Pass metadata to the trigger function
        first_name: data.firstName,
        last_name: data.lastName,
        role: data.role,
      },
    },
  };

  console.log('[Signup Action] Calling supabase.auth.signUp with options:', JSON.stringify(signUpOptions, null, 2));

  // Call Supabase signUp
  const { error } = await supabase.auth.signUp(signUpOptions);

  // Handle errors
  if (error) {
    console.error('[Signup Action] Signup error:', error.message);

    if (error.message.includes('User already registered')) {
      // If user exists, redirect to login with a specific message
      let loginRedirectPath = '/login?error=User+already+exists.+Please+log+in.';
      // Preserve priceId if user was trying to purchase
      if (data.priceId) {
        loginRedirectPath += `&priceId=${data.priceId}`;
      }
      console.log(`[Signup Action] User exists, redirecting to login: ${loginRedirectPath}`);
      return redirect(loginRedirectPath);
    } else {
      // For other signup errors, redirect back to signup page with the error
      let signupRedirectPath = `/signup?error=${encodeURIComponent(error.message)}`;
       // Preserve priceId if user was trying to purchase
      if (data.priceId) {
         signupRedirectPath += `&priceId=${data.priceId}`;
      }
      return redirect(signupRedirectPath);
    }
  }

  // --- Signup successful ---
  revalidatePath('/', 'layout');

  // Redirect to login page with a message to check email (if applicable)
  // AND set redirect_to=/our-plans so they land there after login
  let loginRedirectPath = '/login?message=Signup+successful!+Please+log+in.'; // Changed message
  loginRedirectPath += `&redirect_to=${encodeURIComponent('/our-plans')}`; // Add redirect_to
  
  // Note: If email confirmation is enabled in Supabase Auth settings, 
  // the user will get an email and need to confirm before logging in.
  // If email confirmation is disabled, they can log in immediately.
  
  console.log(`[Signup Action] Signup successful, redirecting to login (then to /our-plans): ${loginRedirectPath}`);
  redirect(loginRedirectPath);
}

export async function logout() {
  const supabase = createClient();
  await supabase.auth.signOut();

  revalidatePath('/', 'layout');
  redirect('/login');
}
