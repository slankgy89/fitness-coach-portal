import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.5.0';
import { revalidatePath } from 'https://esm.sh/next/cache';

console.log('Stripe webhook function started'); // Add this line

// Initialize Stripe
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
  httpClient: Stripe.createFetchHttpClient(),
});

// Initialize Supabase Admin Client using default env vars
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,      // Use default var
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // Use default var
  { auth: { persistSession: false, autoRefreshToken: false } }
);

type SupabaseAdminClient = typeof supabaseAdmin;

// --- Handler Functions ---

async function handleCheckoutSession(session: Stripe.Checkout.Session, supabase: SupabaseAdminClient) {
  console.log('[Edge Function Webhook] Handling checkout.session.completed event.');
  const userId = session.client_reference_id;
  const stripeSubscriptionId = session.subscription;

  if (session.mode !== 'subscription' || !stripeSubscriptionId || !userId) {
    console.log('[Edge Function Webhook] Not a subscription session or missing data. Skipping.');
    return;
  }

  let supabaseUserId: string | null = null;
  let dbOperationSuccessful = false;

  console.log(`[Edge Function Webhook] Session object:`, JSON.stringify(session, null, 2));
  try {
    console.log(`[Edge Function Webhook] Retrieving Stripe subscription: ${stripeSubscriptionId}`);
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId as string, {
        expand: ['items.data.price.product', 'latest_invoice.subscription_details'],
    });
    console.log('[Edge Function Webhook] Retrieved Stripe Subscription:', JSON.stringify(subscription, null, 2));
    console.log(`[Edge Function Webhook] Subscription object (before metadata access):`, JSON.stringify(subscription, null, 2));

    const planId = subscription.metadata?.plan_id;
    supabaseUserId = subscription.metadata?.user_id;

    console.log(`[Edge Function Webhook] Metadata - plan_id: ${planId}, user_id: ${supabaseUserId}`);

    if (!planId || !supabaseUserId) {
        console.error(`[Edge Function Webhook] CRITICAL: Missing plan_id or user_id in subscription metadata! Sub ID: ${subscription.id}`);
        throw new Error(`Missing required metadata for subscription ${subscription.id}`);
    }
     if (supabaseUserId !== userId) {
         console.warn(`[Edge Function Webhook] Mismatch: metadata user_id (${supabaseUserId}) vs client_reference_id (${userId}). Using metadata user_id.`);
     }

    const subscriptionData = {
      id: subscription.id,
      user_id: supabaseUserId,
      plan_id: planId,
      status: session.status,
      current_period_end: (session as any).current_period_end
        ? new Date((session as any).current_period_end * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    };

    try {
        console.log('[Edge Function DB] START: Upsert for subscription:', subscription.id);
        console.log('[Edge Function DB] START: Upsert for subscription:', subscription.id, 'Data:', JSON.stringify(subscriptionData, null, 2));
        const { error: upsertError } = await supabaseAdmin
            .from('subscriptions')
            .upsert(subscriptionData, { onConflict: 'id' });
        console.log('[Edge Function DB] END: Upsert for subscription:', subscription.id, 'Error:', upsertError);

        if (upsertError) {
            console.error('[Edge Function DB] Supabase upsert FAILED:', upsertError);
        } else {
            dbOperationSuccessful = true;
            console.log('[Edge Function DB] Supabase upsert SUCCEEDED for subscription:', subscription.id);
        }
    } catch (dbCatchError) {
         console.error('[Edge Function DB] CATCH BLOCK: Database operation FAILED:', dbCatchError);
    }

    if (dbOperationSuccessful && supabaseUserId){
        console.log(`[Edge Function Revalidate] Revalidating /dashboard for user ${supabaseUserId}`);
        revalidatePath('/dashboard');
    }

    if (!dbOperationSuccessful) {
        throw new Error(`Database operation failed for subscription ${subscription.id}`);
    }

  } catch (error) {
    console.error('[Edge Function] Error in handleCheckoutSession:', error);
    throw error;
  }
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription, supabase: SupabaseAdminClient) {
    console.log(`[Edge Function Webhook] handleSubscriptionUpdate triggered for subscription: ${subscription.id}`);
    console.log(`[Edge Function Webhook] Handling customer.subscription event: ${subscription.id}, Status: ${subscription.status}`);
    let supabaseUserId: string | null = null;
    let dbOperationSuccessful = false;

    try {
        supabaseUserId = subscription.metadata?.user_id;

        const subscriptionData = {
            status: subscription.status,
            current_period_end: (subscription as any).current_period_end
              ? new Date((session as any).current_period_end * 1000).toISOString()
              : null,
            plan_id: subscription.metadata?.plan_id || subscription.items?.data?.[0]?.price?.metadata?.plan_id || null,
            updated_at: new Date().toISOString(),
        };

        console.log(`[Edge Function Webhook] Updating subscription ${subscription.id} in Supabase with:`, JSON.stringify(subscriptionData, null, 2));

        const { error: updateError } = await supabaseAdmin
            .from('subscriptions')
            .update(subscriptionData)
            .eq('id', subscription.id);

        if (updateError) {
            console.error('[Edge Function Webhook] Supabase subscription update error:', updateError);
        } else {
            dbOperationSuccessful = true;
        } else if (!dbOperationSuccessful) {
             console.log('[Edge Function Revalidate] Skipping revalidation during update due to DB failure.');
        } else if (!supabaseUserId) {
             console.warn(`[Edge Function Revalidate] Cannot revalidate: user_id missing from metadata for updated subscription ${subscription.id}`);
        }

        if (!dbOperationSuccessful) {
            throw new Error(`Database update failed for subscription ${subscription.id}`);
        }

    } catch (error) {
        console.error('[Edge Function Webhook] Error in handleSubscriptionUpdate:', error);
        throw error;
    }
}

// --- Main Serve Function ---
serve(async (req: Request) => {
  console.log(`[Edge Function Webhook] Main serve function triggered`);
  console.log(`[Edge Function] Request received: ${req.method} ${req.url}`); // Log incoming request
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const signature = req.headers.get('stripe-signature');
  let body;
  try {
      body = await req.text(); // Read body early
  } catch (readError) {
       console.error('[Edge Function Webhook Error] Failed to read request body:', readError);
       return new Response('Failed to read request body', { status: 400 });
  }


  if (!signature) {
    console.error('[Edge Function Webhook Error] Missing stripe-signature header');
    return new Response('Missing signature', { status: 400 });
  }

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!webhookSecret) {
      console.error('[Edge Function Webhook Error] Missing STRIPE_WEBHOOK_SECRET env var.');
      return new Response('Webhook secret not configured', { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEvent(body, signature, webhookSecret);
    console.log(`[Edge Function Webhook] Event constructed successfully. Type: ${event.type}`);
  } catch (err: any) {
    console.error(`[Edge Function Webhook Error] Error constructing event: ${err?.message}`, err);
    return new Response('Webhook error during event construction', { status: 400 });
  }

  try {
    switch (event.type) {
    case 'checkout.session.completed':
        await handleCheckoutSession(event.data.object as Stripe.Checkout.Session, supabaseAdmin);
        break;
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
    case 'customer.subscription.paused':
    case 'customer.subscription.resumed':
    case 'customer.subscription.trial_will_end':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription, supabaseAdmin);
        break;
    default:
        console.log(`[Edge Function Webhook] Unhandled event type ${event.type}`);
    }
     console.log(`[Edge Function Webhook] Finished processing event type: ${event.type}`);
     return new Response(JSON.stringify({ received: true }), { status: 200 });

  } catch (handlerError: any) {
     console.error(`[Edge Function Webhook Error] Error during handler execution for ${event.type}:`, handlerError);
     // Still return 200 OK to Stripe
     return new Response(JSON.stringify({ received: true, error: `Internal handler error: ${handlerError.message}` }), { status: 200 });
  }
});

console.log('Stripe Webhook Edge Function starting...');
