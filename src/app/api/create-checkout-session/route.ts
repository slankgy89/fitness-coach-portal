import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const supabase = createClient();
  // Read all expected parameters from the request body
  const { priceId, userId: clientUserId, coachStripeAccountId, planId } = await req.json(); 

  // Validate required parameters
  if (!priceId || !clientUserId || !coachStripeAccountId || !planId) {
      console.error('API Checkout Error: Missing required parameters in request body.');
      return NextResponse.json({ error: { message: 'Missing required parameters.' } }, { status: 400 });
  }

  try {
    // Note: We might not strictly need to re-fetch the user/profile here if we trust
    // the clientUserId passed from the client-side fetch, but it adds a layer of server-side validation.
    // Let's keep it for now.
    const { data: { user }, error: userError } = await supabase.auth.getUser();
     if (userError || !user || user.id !== clientUserId) { // Verify logged-in user matches request
       console.error('API Auth Error or Mismatch:', userError, `Requested User: ${clientUserId}, Session User: ${user?.id}`);
       return NextResponse.json({ error: { message: 'User authentication mismatch or error.' } }, { status: 401 });
     }

     // Fetch client's profile to get/create stripe_customer_id
     const { data: profile, error: profileError } = await supabase
       .from('profiles')
       .select('id, stripe_customer_id, email') // Select email too
       .eq('id', user.id)
       .single();

     if (profileError) { // Handle error properly
         console.error("API Profile Error:", profileError);
         throw new Error(`Error fetching profile: ${profileError.message}`);
     }
     if (!profile) {
          console.error(`Profile not found for authenticated user ID: ${user.id}`);
          throw new Error(`Profile not found for user.`);
     }

     // --- Get or Create Stripe Customer ON THE CONNECTED ACCOUNT ---
     let connectedAccountCustomerId: string;

     // 1. Search for existing customer on the connected account by email
     console.log(`[Checkout] Searching for customer ${profile.email} on account ${coachStripeAccountId}`);
     const existingCustomers = await stripe.customers.list(
        { email: profile.email!, limit: 1 },
        { stripeAccount: coachStripeAccountId } // Specify the connected account
     );

     if (existingCustomers.data.length > 0) {
        connectedAccountCustomerId = existingCustomers.data[0].id;
        console.log(`[Checkout] Found existing customer ${connectedAccountCustomerId} on account ${coachStripeAccountId}`);
     } else {
        // 2. Create new customer on the connected account if not found
        console.log(`[Checkout] Creating new customer ${profile.email} on account ${coachStripeAccountId}`);
        const newCustomer = await stripe.customers.create(
            { email: profile.email! },
            { stripeAccount: coachStripeAccountId } // Specify the connected account
        );
        connectedAccountCustomerId = newCustomer.id;
        console.log(`[Checkout] Created new customer ${connectedAccountCustomerId} on account ${coachStripeAccountId}`);
        // DO NOT update the Supabase profile's stripe_customer_id here,
        // as that field should store the platform's customer ID if needed elsewhere.
     }
     // --- End Customer Handling ---

    // --- Create Checkout Session on the COACH'S Connected Account ---
    const sessionPayload = {
      customer: connectedAccountCustomerId,
      payment_method_types: ['card'] as Stripe.Checkout.SessionCreateParams.PaymentMethodType[],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      mode: 'subscription' as Stripe.Checkout.SessionCreateParams.Mode, // Explicitly cast mode
      subscription_data: {
        // trial_period_days: 14, // Optional: Add trial if needed
        metadata: {
            // Pass Supabase plan_id and user_id to webhook via metadata
            plan_id: planId,
            user_id: user.id
        },
        // Attempt to explicitly tell Stripe where to send events for THIS session
        // This might not be standard, but worth trying given the issues
        // transfer_data: { // This is usually for direct charges, maybe not needed for destination
        //   destination: coachStripeAccountId,
        // },
      },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/our-plans`,
      // Pass the Supabase user ID for potential use, though metadata is preferred for webhook
      client_reference_id: user.id,
    };
    console.log(`[Checkout] Creating session for price ${priceId} on account ${coachStripeAccountId} with payload:`, JSON.stringify(sessionPayload, null, 2));
    
    const session = await stripe.checkout.sessions.create(
        sessionPayload, 
        { stripeAccount: coachStripeAccountId } // Specify the connected account ID!
    );

    console.log(`[Checkout] Successfully created session ID: ${session.id}`);
    return NextResponse.json({ sessionId: session.id });
  } catch (err: any) {
    console.error('Error creating checkout session:', err);
    return NextResponse.json(
      { error: { message: err.message } },
      { status: 500 }
    );
  }
}
