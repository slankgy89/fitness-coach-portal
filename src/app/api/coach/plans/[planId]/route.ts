import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server'; // Use regular server client for auth + RLS

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Define a simple interface for the update payload
interface PlanUpdatePayload {
    is_active?: boolean;
    name?: string;
    description?: string | null;
    features?: string[] | null;
    // Add price/interval fields for update payload
    price?: number; // Price in cents
    currency?: string;
    interval?: 'day' | 'week' | 'month' | 'year';
    interval_count?: number;
    is_publicly_featured?: boolean; // Add the new flag
}

// --- PUT Handler (Update Plan details including price/interval) ---
export async function PUT(req: Request, { params }: { params: { planId: string } }) {
  const supabase = createClient();
  const planId = params.planId; // Get planId from the route segment

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Fetch the plan AND coach's stripe_account_id together
    // RLS ensures the coach only gets their own plan
    const { data: planData, error: fetchError } = await supabase
      .from('coach_plans')
      .select(`
        *,
        profiles ( stripe_account_id ) 
      `)
      .eq('id', planId)
      .eq('coach_id', user.id) // Ensure ownership
      .single();

    if (fetchError) throw fetchError;
    if (!planData) throw new Error('Plan not found or user does not own it.');
    
    // Type assertion needed because Supabase join return type is complex
    const coachStripeAccountId = (planData.profiles as { stripe_account_id: string })?.stripe_account_id; 
    if (!coachStripeAccountId) throw new Error('Coach Stripe account not connected or found.');

    // Get all potential update data from request body
    const updates: PlanUpdatePayload = await req.json(); 
    const { 
        is_active, 
        name, 
        description, 
        features, 
        price, // new price in cents
        currency, 
        interval, 
        interval_count,
        is_publicly_featured // Destructure the new flag
    } = updates;

    let newStripePriceId = planData.stripe_price_id; // Assume old price ID unless changed
    let priceChanged = false;
    let newStripePriceRequired = false;

    // Determine the values to use for the update, falling back to existing plan data
    const finalPrice = (typeof price === 'number' && price > 0) ? price : planData.price;
    const finalCurrency = currency || planData.currency;
    const finalInterval = interval || planData.interval;
    const finalIntervalCount = (typeof interval_count === 'number' && interval_count > 0) ? interval_count : planData.interval_count;

    // Check if any price-related field has actually changed
    if (finalPrice !== planData.price || 
        finalCurrency !== planData.currency || 
        finalInterval !== planData.interval || 
        finalIntervalCount !== planData.interval_count) 
    {
        newStripePriceRequired = true;
        priceChanged = true; // Indicate that Supabase needs updating with new price details
        console.log(`[API PUT /coach/plans/${planId}] Price/Interval change detected.`);

        // Validate the final values
        if (finalPrice <= 0) throw new Error('Invalid price amount');
        if (!['day', 'week', 'month', 'year'].includes(finalInterval)) throw new Error('Invalid interval value');
        if (finalIntervalCount <= 0 || !Number.isInteger(finalIntervalCount)) throw new Error('Invalid interval count');
        if (!finalCurrency) throw new Error('Currency is required');

        // 1. Create new Stripe Price
        console.log(`[API PUT /coach/plans/${planId}] Creating new Stripe Price for product ${planData.stripe_product_id} on account ${coachStripeAccountId}`);
        const newStripePrice = await stripe.prices.create({
            product: planData.stripe_product_id,
            unit_amount: finalPrice, // Use final price
            currency: finalCurrency, // Use final currency
            recurring: {
                interval: finalInterval, // Use final interval
                interval_count: finalIntervalCount, // Use final interval count
            },
        }, { stripeAccount: coachStripeAccountId });
        newStripePriceId = newStripePrice.id; // Store the new price ID
        console.log(`[API PUT /coach/plans/${planId}] New Stripe Price created: ${newStripePriceId}`);

        // 2. Archive the old Stripe Price
        console.log(`[API PUT /coach/plans/${planId}] Archiving old Stripe Price ${planData.stripe_price_id} on account ${coachStripeAccountId}`);
        await stripe.prices.update(
            planData.stripe_price_id,
            { active: false },
            { stripeAccount: coachStripeAccountId }
        );
        console.log(`[API PUT /coach/plans/${planId}] Old Stripe Price archived.`);
    }

    // --- Prepare Supabase Update Data ---
    const supabaseUpdateData: Partial<any> & { updated_at: string } = { 
        updated_at: new Date().toISOString(),
    };
    // Include non-price fields if they were provided in the request
    if (updates.hasOwnProperty('name') && typeof name === 'string') supabaseUpdateData.name = name;
    if (updates.hasOwnProperty('description')) supabaseUpdateData.description = description; // Allow null
    if (updates.hasOwnProperty('features')) supabaseUpdateData.features = features; // Allow null or array
    if (updates.hasOwnProperty('is_active') && typeof is_active === 'boolean') supabaseUpdateData.is_active = is_active;
    if (updates.hasOwnProperty('is_publicly_featured') && typeof is_publicly_featured === 'boolean') supabaseUpdateData.is_publicly_featured = is_publicly_featured; // Add update logic for the flag

    // Include new price/interval details ONLY if they actually changed
    if (priceChanged) {
        supabaseUpdateData.stripe_price_id = newStripePriceId;
        supabaseUpdateData.price = finalPrice;
        supabaseUpdateData.currency = finalCurrency;
        supabaseUpdateData.interval = finalInterval;
        supabaseUpdateData.interval_count = finalIntervalCount;
    }

    // --- Update Stripe Product (Name/Description) ---
    // This can happen regardless of price change
    const productUpdates: { name?: string; description?: string | null } = {};
    if (typeof name === 'string' && name !== planData.name) {
        productUpdates.name = name;
    }
    if ((typeof description === 'string' || description === null) && description !== planData.description) {
        productUpdates.description = description || ''; // Stripe description cannot be null
    }

    if (Object.keys(productUpdates).length > 0) {
        console.log(`[API PUT /coach/plans/${planId}] Updating Stripe Product ${planData.stripe_product_id} on account ${coachStripeAccountId}`);
        await stripe.products.update(
            planData.stripe_product_id,
            productUpdates,
            { stripeAccount: coachStripeAccountId }
        );
        console.log(`[API PUT /coach/plans/${planId}] Stripe Product updated.`);
    }

    // --- Update Stripe Price Active Status (if not changed by archiving) ---
    if (!priceChanged && typeof is_active === 'boolean' && is_active !== planData.is_active) {
       console.log(`[API PUT /coach/plans/${planId}] Updating Stripe Price ${planData.stripe_price_id} active status to ${is_active} on account ${coachStripeAccountId}`);
       await stripe.prices.update(
           planData.stripe_price_id,
           { active: is_active },
           { stripeAccount: coachStripeAccountId }
       );
       console.log(`[API PUT /coach/plans/${planId}] Stripe Price active status updated.`);
    }

    // --- Update Supabase coach_plans table ---
    if (Object.keys(supabaseUpdateData).length > 1) { // Check if there's more than just updated_at
        console.log(`[API PUT /coach/plans/${planId}] Updating Supabase plan with:`, supabaseUpdateData);
        const { data: updatedPlan, error: updateError } = await supabase
          .from('coach_plans')
          .update(supabaseUpdateData)
          .eq('id', planId)
          .eq('coach_id', user.id) // Redundant check due to RLS, but good practice
          .select()
          .single();

        if (updateError) throw updateError;

        console.log(`[API PUT /coach/plans/${planId}] Supabase plan updated.`);
        return NextResponse.json({ plan: updatedPlan });
    } else {
        // No actual changes detected besides timestamp
        console.log(`[API PUT /coach/plans/${planId}] No changes detected, returning original plan data.`);
        // We need to return the original plan data structure here
        // Fetching again or returning planData (need to remove joined profile first)
        const { profiles, ...originalPlan } = planData; // Exclude joined profile data
        return NextResponse.json({ plan: originalPlan });
    }

  } catch (err: any) {
    console.error(`[API PUT /coach/plans/${planId}] Error:`, err);
    const errorMessage = err.raw?.message || err.message || 'Failed to update plan';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}


// --- DELETE Handler (Optional - Deactivate Only Recommended) ---
// Deleting Stripe Products/Prices can cause issues if subscriptions exist.
// It's often better to just deactivate (set is_active=false via PUT).
// If true deletion is needed, add extra checks for existing subscriptions.

// export async function DELETE(req: Request, { params }: { params: { planId: string } }) {
//   // ... similar auth and ownership checks ...
//   // 1. Deactivate Stripe Price (stripe.prices.update(priceId, { active: false }, { stripeAccount: ... }))
//   // 2. Optionally archive Stripe Product (stripe.products.update(productId, { active: false }, { stripeAccount: ... }))
//   // 3. Delete from Supabase coach_plans table
//   // ... error handling ...
//   return NextResponse.json({ message: 'Plan deactivated/deleted' });
// }
