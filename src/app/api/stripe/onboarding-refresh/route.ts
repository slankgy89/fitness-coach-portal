import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server'; // Regular server client for auth check

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;

export async function GET(req: Request) {
  const supabase = createClient(); // For checking user auth

  try {
    // 1. Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      // Redirect to login if not authenticated
      return NextResponse.redirect(new URL('/login', siteUrl)); 
    }

    // 2. Get coach's Stripe Account ID from their profile
    // Note: We use the regular client here as RLS allows users to read their own profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;
    if (!profile || !profile.stripe_account_id) {
      throw new Error('Stripe account ID not found for user.');
    }

    const accountId = profile.stripe_account_id;

    // 3. Create a new Account Link
    console.log('[Connect Refresh] Creating new account link for account:', accountId);
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${siteUrl}/api/stripe/onboarding-refresh`, // Point back to self
      return_url: `${siteUrl}/coach/settings?stripe_connect=success`, // Back to settings on success
      type: 'account_onboarding',
    });
    console.log('[Connect Refresh] New account link created:', accountLink.url);

    // 4. Redirect user to the new onboarding URL
    return NextResponse.redirect(accountLink.url);

  } catch (err: any) {
    console.error('[Connect Refresh] Error refreshing account link:', err);
    // Redirect to settings page with an error
    const errorUrl = new URL('/coach/settings', siteUrl);
    errorUrl.searchParams.set('stripe_connect', 'error');
    errorUrl.searchParams.set('error_message', err.message || 'Failed to refresh Stripe connection link');
    return NextResponse.redirect(errorUrl);
  }
}
