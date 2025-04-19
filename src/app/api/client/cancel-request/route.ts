import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('[API Cancel Request] Authentication error:', authError);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let subscriptionId: string | undefined;
  let reason: string | undefined;

  try {
    const body = await req.json();
    subscriptionId = body.subscriptionId;
    reason = body.reason;
  } catch (jsonError) {
    console.error('[API Cancel Request] Error parsing request body:', jsonError);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }


  if (!subscriptionId) {
     console.error('[API Cancel Request] Missing subscriptionId in request body');
     return NextResponse.json({ error: 'Missing subscriptionId' }, { status: 400 });
  }

  console.log(`[API Cancel Request] User ${user.id} requesting cancellation for sub: ${subscriptionId}`);

  try {
    console.log(`[API Cancel Request] Retrieving Stripe subscription: ${subscriptionId}`);
    // Get subscription details from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    console.log(`[API Cancel Request] Retrieved Stripe subscription status: ${subscription.status}`);
    const planId = subscription.metadata?.plan_id; // Use optional chaining

    if (!planId) {
      console.error(`[API Cancel Request] Plan ID not found in metadata for subscription ${subscriptionId}`);
      return NextResponse.json({ error: 'Plan ID not found in subscription metadata.' }, { status: 400 });
    }
    console.log(`[API Cancel Request] Found planId: ${planId}`);

    console.log(`[API Cancel Request] Looking up plan details for planId: ${planId}`);
    // Get plan details from Supabase
    const { data: plan, error: planError } = await supabase
      .from('coach_plans')
      .select('id, coach_id, requires_approval') // Only select needed fields
      .eq('id', planId)
      .single();

    // Handle specific error for plan not found
    if (planError && planError.code === 'PGRST116') { // PGRST116: No rows found
        console.error(`[API Cancel Request] Plan with ID ${planId} not found in coach_plans table.`);
        return NextResponse.json({ error: `Plan not found for ID: ${planId}` }, { status: 404 });
    }
    if (planError) { // Handle other potential plan query errors
        console.error(`[API Cancel Request] Error fetching plan details:`, planError);
        throw planError; // Let the outer catch handle it
    }
    if (!plan) { // Should be caught by PGRST116, but as a fallback
        console.error(`[API Cancel Request] Plan data unexpectedly null for ID: ${planId}`);
        return NextResponse.json({ error: `Plan data not found for ID: ${planId}` }, { status: 404 });
    }
    console.log(`[API Cancel Request] Found plan details. Coach ID: ${plan.coach_id}, Requires Approval: ${plan.requires_approval}`);

    const requestPayload = {
        subscription_id: subscriptionId,
        client_id: user.id,
        coach_id: plan.coach_id,
        plan_id: planId,
        client_reason: reason || null, // Ensure reason is null if empty/undefined
        status: plan.requires_approval ? 'pending' : 'approved' // Set status based on plan setting
    };

    console.log('[API Cancel Request] Inserting cancellation request:', JSON.stringify(requestPayload, null, 2));
    // Create cancellation request
    const { data, error: insertError } = await supabase
      .from('cancellation_requests')
      .insert([requestPayload]) // Use the payload variable
      .select()
      .single();

    // Specific check for insert error
    if (insertError) {
        console.error(`[API Cancel Request] Error inserting cancellation request:`, insertError);
        // Provide a more specific error message if possible
        return NextResponse.json({ error: `Failed to create cancellation request: ${insertError.message}` }, { status: 500 });
    }

    console.log('[API Cancel Request] Cancellation request created successfully:', JSON.stringify(data, null, 2));
    return NextResponse.json({ request: data });

  } catch (err: any) {
    // Catch any other unexpected errors (e.g., Stripe API error, unexpected DB error)
    console.error('[API Cancel Request] Unexpected error:', err);
    // Check if it's a Stripe error
     if (err.type && err.type.startsWith('Stripe')) {
         return NextResponse.json({ error: `Stripe Error: ${err.message}` }, { status: 400 });
     }
    return NextResponse.json({ error: err.message || 'An unexpected server error occurred.' }, { status: 500 });
  }
}
