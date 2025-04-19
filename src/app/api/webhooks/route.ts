import { NextResponse } from 'next/server';
import Stripe from 'stripe';
// Import the specific type for createClient and the client type itself
import { SupabaseClient, createClient as createServerSupabaseClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Create a separate Supabase client instance using the service role key
// This client bypasses RLS
const supabaseAdmin = createServerSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  // Explicitly disable session persistence for admin client
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export async function POST(req: Request) {
  console.log(`[Webhook] POST request received at /api/webhooks. Timestamp: ${new Date().toISOString()}`);
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  if (!signature) {
    console.error('[Webhook Error] Missing stripe-signature header');
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    console.log(`[Webhook] Received event type: ${event.type}`);
    console.log('[Webhook] Full Event Data:', JSON.stringify(event.data.object, null, 2));
  } catch (err: any) {
    console.error(`[Webhook Error] Error constructing event: ${err?.message}`, err);
    if (err.type === 'StripeSignatureVerificationError') {
        return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Webhook error during event construction' }, { status: 400 });
  }

  // Wrap handler calls in try/catch to ensure response is sent even if handler fails
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSession(session, supabaseAdmin); // Await the handler
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed':
      case 'customer.subscription.trial_will_end':
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription, supabaseAdmin); // Await the handler
        break;
      default:
        console.log(`[Webhook] Unhandled event type ${event.type}`);
    }
     // If switch completes without error from handlers
     console.log(`[Webhook] Finished processing event type: ${event.type}`);
     return NextResponse.json({ received: true });

  } catch (handlerError: any) {
     // Catch errors specifically thrown from handleCheckoutSession or handleSubscriptionUpdate
     console.error(`[Webhook Error] Error during handler execution for ${event.type}:`, handlerError);
     // Still return 200 OK to Stripe to acknowledge receipt, but log the internal error
     return NextResponse.json({ received: true, error: `Internal handler error: ${handlerError.message}` });
  }
}

// Explicitly type the supabase parameter
async function handleCheckoutSession(session: Stripe.Checkout.Session, supabase: SupabaseClient) {
  console.log('[Webhook] Handling checkout.session.completed event.');

  const userId = session.client_reference_id;
  const stripeSubscriptionId = session.subscription;

  if (session.mode !== 'subscription' || !stripeSubscriptionId || !userId) {
    console.log('[Webhook] Not a subscription session or missing subscription/user ID. Skipping.');
    return; // Exit function early
  }

  let supabaseUserId: string | null = null;
  let dbOperationSuccessful = false;

  // Wrap entire handler logic in try/catch to ensure errors are caught and potentially thrown
  try {
    console.log(`[Webhook] Retrieving Stripe subscription details for ID: ${stripeSubscriptionId}`);
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId as string, {
        expand: ['items.data.price.product'],
    });
    console.log('[Webhook] Retrieved Stripe Subscription:', { id: subscription.id, status: subscription.status, current_period_end: subscription.current_period_end, metadata: subscription.metadata });

    const planId = subscription.metadata?.plan_id;
    supabaseUserId = subscription.metadata?.user_id;

    console.log(`[Webhook] Extracted from metadata - plan_id: ${planId}, user_id: ${supabaseUserId}`);

    if (!planId) {
        console.error(`[Webhook] CRITICAL: plan_id missing from subscription metadata! Sub ID: ${subscription.id}`);
        throw new Error(`plan_id not found in subscription metadata for ${subscription.id}`);
    }
     if (!supabaseUserId) {
        console.error(`[Webhook] CRITICAL: user_id missing from subscription metadata! Sub ID: ${subscription.id}`);
        throw new Error(`user_id not found in subscription metadata for ${subscription.id}`);
    }
     if (supabaseUserId !== userId) {
         console.warn(`[Webhook] Mismatch between metadata user_id (${supabaseUserId}) and client_reference_id (${userId}). Using metadata user_id.`);
     }

    const subscriptionData = {
      id: subscription.id,
      user_id: supabaseUserId,
      plan_id: planId,
      status: subscription.status,
      current_period_end: (subscription as any).current_period_end
        ? new Date((subscription as any).current_period_end * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    };

    // --- Database Operation ---
    // This inner try/catch logs DB errors but allows revalidation attempt
    try {
        console.log('[Webhook DB] ENTERING TRY BLOCK for DB operation. Sub ID:', subscription.id);
        console.log('[Webhook DB] START: Attempting upsert for subscription:', subscription.id);
        console.log('[Webhook DB] Upsert Payload:', JSON.stringify(subscriptionData, null, 2));

        const { error: upsertError } = await supabaseAdmin
            .from('subscriptions')
            .upsert(subscriptionData, { onConflict: 'id' });

        if (upsertError) {
            console.error('[Webhook DB] Supabase upsert FAILED:', upsertError);
            // Set flag but don't throw here to allow revalidation attempt
            dbOperationSuccessful = false;
        } else {
            dbOperationSuccessful = true;
            console.log('[Webhook DB] Supabase upsert SUCCEEDED for subscription:', subscription.id);
        }
    } catch (dbCatchError) {
         console.error('[Webhook DB] CATCH BLOCK: Database operation FAILED:', dbCatchError);
         dbOperationSuccessful = false;
    }
    // --- End Database Operation ---

    // --- Trigger Revalidation (only if DB update succeeded) ---
    if (dbOperationSuccessful && supabaseUserId) {
        console.log(`[Webhook Revalidate] Triggering revalidation for user: ${supabaseUserId} after successful DB op.`);
        // Fire-and-forget fetch call
        fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/revalidate-subscription`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: supabaseUserId,
                secret: process.env.REVALIDATION_SECRET
            })
        }).then(res => {
             if (!res.ok) {
                 res.text().then(text => console.error(`[Webhook Revalidate] API call failed with status: ${res.status}, body: ${text}`));
             } else {
                 console.log(`[Webhook Revalidate] API call successful for user: ${supabaseUserId}`);
             }
        }).catch(err => {
            console.error('[Webhook Revalidate] Fetch failed:', err);
        });
    } else if (!dbOperationSuccessful) {
         console.log('[Webhook Revalidate] Skipping revalidation due to DB operation failure.');
    } else if (!supabaseUserId) {
         console.warn('[Webhook Revalidate] Skipping revalidation because supabaseUserId is missing.');
    }
    // --- End Revalidation Trigger ---

    // If the DB operation failed earlier, throw an error now to be caught by the outer handler
    if (!dbOperationSuccessful) {
        throw new Error(`Database operation failed for subscription ${subscription.id}`);
    }

  } catch (error) {
    console.error('[Webhook] Error within handleCheckoutSession logic:', error);
    throw error; // Re-throw the error to be caught by the main POST handler's catch block
  }
}

// Explicitly type the supabase parameter
async function handleSubscriptionUpdate(subscription: Stripe.Subscription, supabase: SupabaseClient) {
  console.log(`[Webhook] Handling customer.subscription event: ${subscription.id}, Status: ${subscription.status}`);
  let supabaseUserId: string | null = null;
  let dbOperationSuccessful = false;

  try {
     supabaseUserId = subscription.metadata?.user_id;

    const subscriptionData = {
        status: subscription.status,
        current_period_end: (subscription as any).current_period_end
          ? new Date((subscription as any).current_period_end * 1000).toISOString()
          : null,
        plan_id: subscription.metadata?.plan_id || subscription.items?.data?.[0]?.price?.metadata?.plan_id || null,
        updated_at: new Date().toISOString(),
      };

    console.log(`[Webhook] Updating subscription ${subscription.id} in Supabase with:`, JSON.stringify(subscriptionData, null, 2));

    const { error: updateError } = await supabaseAdmin
      .from('subscriptions')
      .update(subscriptionData)
      .eq('id', subscription.id);

    if (updateError) {
      console.error('[Webhook] Supabase subscription update error:', updateError);
      // Don't re-throw yet
    } else {
        dbOperationSuccessful = true;
        console.log(`[Webhook] Subscription ${subscription.id} updated successfully.`);
    }

     // --- Trigger Revalidation ---
     if (dbOperationSuccessful && supabaseUserId) {
         console.log(`[Webhook Revalidate] Triggering revalidation for user: ${supabaseUserId} after successful DB update.`);
         fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/revalidate-subscription`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
                 userId: supabaseUserId,
                 secret: process.env.REVALIDATION_SECRET
             })
         }).then(res => {
              if (!res.ok) {
                   res.text().then(text => console.error(`[Webhook Revalidate] API call failed during update with status: ${res.status}, body: ${text}`));
              } else {
                  console.log(`[Webhook Revalidate] API call successful during update for user: ${supabaseUserId}`);
              }
         }).catch(err => {
             console.error('[Webhook Revalidate] Fetch failed during update:', err);
         });
     } else if (!dbOperationSuccessful) {
         console.log('[Webhook Revalidate] Skipping revalidation during update due to DB operation failure.');
     } else if (!supabaseUserId) {
          console.warn(`[Webhook] Cannot revalidate: user_id missing from metadata for updated subscription ${subscription.id}`);
     }
      // --- End Revalidation Trigger ---

      // If DB operation failed, throw error
      if (!dbOperationSuccessful) {
          throw new Error(`Database update failed for subscription ${subscription.id}`);
      }

  } catch (error) {
     console.error('[Webhook] Error in handleSubscriptionUpdate:', error);
     throw error; // Re-throw error
  }
}
