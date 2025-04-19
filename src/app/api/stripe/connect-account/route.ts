import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server'; // Regular server client for auth check
import { createClient as createAdminClient } from '@supabase/supabase-js'; // Admin client for DB update

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;

// Admin client to bypass RLS for updating profiles table
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export async function POST(req: Request) {
  const supabase = createClient(); // For checking user auth

  try {
    // 1. Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // 2. Verify user is a coach (fetch profile)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, stripe_account_id, email') // Include email
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;
    if (!profile) throw new Error('Profile not found');
    if (profile.role !== 'coach') {
      return NextResponse.json({ error: 'User is not a coach' }, { status: 403 });
    }

    let accountId = profile.stripe_account_id;
    let accountLinkUrl: string | null = null;

    // 3. Create Stripe Account if it doesn't exist
    if (!accountId) {
      console.log('[Connect] Creating Stripe account for coach:', user.id);
      const account = await stripe.accounts.create({
        type: 'standard',
        email: profile.email || user.email, // Use profile email or auth email
        // Add other details if needed (business_profile, etc.)
      });
      accountId = account.id;

      // Update profile with the new account ID (use admin client)
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ stripe_account_id: accountId })
        .eq('id', user.id);

      if (updateError) {
        console.error('[Connect] Error updating profile with stripe_account_id:', updateError);
        // Don't throw here, maybe try creating link anyway? Or return error?
        // For now, log and continue
      } else {
         console.log('[Connect] Profile updated with stripe_account_id:', accountId);
      }
    }

    // 4. Create Account Link
    if (accountId) {
       console.log('[Connect] Creating account link for account:', accountId);
       const accountLink = await stripe.accountLinks.create({
         account: accountId,
         // TODO: Define these routes in your app
         refresh_url: `${siteUrl}/api/stripe/onboarding-refresh`, 
         return_url: `${siteUrl}/coach/settings?stripe_connect=success`, 
         type: 'account_onboarding',
       });
       accountLinkUrl = accountLink.url;
       console.log('[Connect] Account link created:', accountLinkUrl);
    } else {
       throw new Error('Failed to create or retrieve Stripe Account ID');
    }

    // 5. Return the onboarding URL
    return NextResponse.json({ url: accountLinkUrl });

  } catch (err: any) {
    console.error('[Connect] Error creating account link:', err);
    return NextResponse.json(
      { error: { message: err.message || 'Failed to create Stripe Connect link' } },
      { status: 500 }
    );
  }
}
