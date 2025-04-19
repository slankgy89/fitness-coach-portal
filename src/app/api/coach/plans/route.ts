import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server'; // Use regular server client for auth + RLS

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// --- GET Handler (Fetch Coach's Plans) ---
export async function GET(req: Request) {
  const supabase = createClient();
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // RLS policy ensures coach can only select their own plans
    const { data: plans, error: plansError } = await supabase
      .from('coach_plans')
      .select('*')
      .eq('coach_id', user.id)
      .order('created_at', { ascending: false });

    if (plansError) throw plansError;

    return NextResponse.json({ plans });

  } catch (err: any) {
    console.error('[API GET /coach/plans] Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch plans' }, { status: 500 });
  }
}


// --- POST Handler (Create New Plan) ---
export async function POST(req: Request) {
  const supabase = createClient();
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Fetch coach's profile to get stripe_account_id and verify role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, stripe_account_id')
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;
    if (!profile) throw new Error('Coach profile not found.');
    if (profile.role !== 'coach') throw new Error('User is not a coach.');
    if (!profile.stripe_account_id) throw new Error('Coach Stripe account not connected.');

    const coachStripeAccountId = profile.stripe_account_id;

    // Parse request body for plan details
    // Updated to receive interval_count correctly
    const { name, description, price, currency = 'usd', interval = 'month', interval_count, features } = await req.json(); 

    // Updated validation to include interval_count
    if (!name || !price || !currency || !interval || !interval_count) { 
      return NextResponse.json({ error: 'Missing required plan fields (name, price, currency, interval, interval_count)' }, { status: 400 }); 
    }
    if (typeof price !== 'number' || price <= 0) { 
      return NextResponse.json({ error: 'Invalid price amount' }, { status: 400 }); 
    }
    if (typeof interval_count !== 'number' || interval_count <= 0 || !Number.isInteger(interval_count)) {
      return NextResponse.json({ error: 'Invalid interval count (must be a positive integer)' }, { status: 400 });
    }
    // Validate interval value
    const validIntervals: Stripe.PriceCreateParams.Recurring.Interval[] = ['day', 'week', 'month', 'year'];
    if (!validIntervals.includes(interval)) {
      return NextResponse.json({ error: 'Invalid interval value' }, { status: 400 });
    }

    // 1. Create Stripe Product
    console.log(`[API POST /coach/plans] Creating Stripe Product for coach ${user.id} on account ${coachStripeAccountId}`);
    const product = await stripe.products.create({ name: name, description: description || undefined, }, { stripeAccount: coachStripeAccountId });
    console.log(`[API POST /coach/plans] Stripe Product created: ${product.id}`);

    // 2. Create Stripe Price - Pass interval and interval_count
    console.log(`[API POST /coach/plans] Creating Stripe Price for product ${product.id} with interval ${interval_count} ${interval}(s)`);
    const stripePrice = await stripe.prices.create({ 
      product: product.id, 
      unit_amount: price, 
      currency: currency, 
      recurring: { 
        interval: interval, 
        interval_count: interval_count, // Use the provided interval_count
      }, 
    }, { stripeAccount: coachStripeAccountId });
    console.log(`[API POST /coach/plans] Stripe Price created: ${stripePrice.id}`);

    // 3. Save plan details to Supabase - Include interval_count
    const planData = { 
      coach_id: user.id, 
      stripe_product_id: product.id, 
      stripe_price_id: stripePrice.id, 
      name: name, 
      description: description || null, 
      price: price, 
      currency: currency, 
      interval: interval, 
      interval_count: interval_count, // Save interval_count
      features: features || null, 
      is_active: true, 
    };
    console.log(`[API POST /coach/plans] Saving plan to Supabase:`, planData);
    const { data: newPlan, error: insertError } = await supabase
      .from('coach_plans')
      .insert(planData)
      .select()
      .single();
    if (insertError) { 
      console.error('[API POST /coach/plans] Supabase insert error:', insertError); 
      // Attempt to archive the Stripe product/price if DB insert fails? Maybe too complex for now.
      throw insertError; 
    }

    console.log(`[API POST /coach/plans] Plan saved to Supabase:`, newPlan);
    return NextResponse.json({ plan: newPlan });

  } catch (err: any) {
    console.error('[API POST /coach/plans] Error:', err);
    const errorMessage = err.raw?.message || err.message || 'Failed to create plan';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// --- DELETE Handler (Bulk Deactivate Plans) ---
export async function DELETE(req: Request) {
    const supabase = createClient();
    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Fetch coach's Stripe Account ID
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('stripe_account_id')
            .eq('id', user.id)
            .single();

        if (profileError) throw profileError;
        if (!profile || !profile.stripe_account_id) {
            throw new Error('Coach Stripe account not connected or found.');
        }
        const coachStripeAccountId = profile.stripe_account_id;

        // Get array of plan IDs from request body
        const { planIds } = await req.json();
        if (!Array.isArray(planIds) || planIds.length === 0) {
            return NextResponse.json({ error: 'Invalid request body, expected { "planIds": [...] }' }, { status: 400 });
        }

        // Fetch the plans to ensure ownership and get stripe_price_id
        // RLS ensures coach can only select their own plans
        const { data: plansToDeactivate, error: fetchError } = await supabase
            .from('coach_plans')
            .select('id, stripe_price_id, is_active')
            .in('id', planIds)
            .eq('coach_id', user.id); // Verify ownership again

        if (fetchError) throw fetchError;
        if (!plansToDeactivate || plansToDeactivate.length === 0) {
             return NextResponse.json({ error: 'No valid plans found for deactivation.' }, { status: 404 });
        }
        
        // Define interface for results
        interface DeactivationResults {
            deactivated: string[];
            errors: { id: string; error: string }[];
        }
        const results: DeactivationResults = { deactivated: [], errors: [] };

        // Deactivate each plan in Stripe and Supabase
        for (const plan of plansToDeactivate) {
            try {
                // Only deactivate if currently active
                if (plan.is_active) {
                    // 1. Deactivate Stripe Price
                    console.log(`[API DELETE /coach/plans] Deactivating Stripe Price ${plan.stripe_price_id} on account ${coachStripeAccountId}`);
                    await stripe.prices.update(
                        plan.stripe_price_id,
                        { active: false },
                        { stripeAccount: coachStripeAccountId }
                    );
                    console.log(`[API DELETE /coach/plans] Stripe Price ${plan.stripe_price_id} deactivated.`);

                    // 2. Update Supabase (RLS allows coach to update their own plan)
                    console.log(`[API DELETE /coach/plans] Updating Supabase plan ${plan.id} to inactive`);
                    const { error: updateError } = await supabase
                        .from('coach_plans')
                        .update({ is_active: false, updated_at: new Date().toISOString() })
                        .eq('id', plan.id)
                        .eq('coach_id', user.id); // Ensure ownership on update

                    if (updateError) throw updateError;
                    
                    results.deactivated.push(plan.id);
                    console.log(`[API DELETE /coach/plans] Supabase plan ${plan.id} updated.`);
                } else {
                     console.log(`[API DELETE /coach/plans] Plan ${plan.id} already inactive, skipping.`);
                     // Optionally add to a 'skipped' array in results
                }
            } catch (err: any) {
                console.error(`[API DELETE /coach/plans] Error deactivating plan ${plan.id}:`, err);
                const errorMsg: string = err.raw?.message || err.message || 'Unknown error';
                const errorEntry: { id: string; error: string } = { id: plan.id, error: errorMsg };
                results.errors.push(errorEntry);
            }
        }

        return NextResponse.json(results);

    } catch (err: any) {
        console.error('[API DELETE /coach/plans] Error:', err);
        const errorMessage = err.raw?.message || err.message || 'Failed to deactivate plans';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
