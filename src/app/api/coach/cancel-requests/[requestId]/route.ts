import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request, { params }: { params: { requestId: string } }) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { action, response, refundAmount, counterOfferPlanId } = await req.json();

  try {
    // Get the cancellation request
    const { data: request, error: requestError } = await supabase
      .from('cancellation_requests')
      .select('*')
      .eq('id', params.requestId)
      .eq('coach_id', user.id)
      .single();

    if (requestError || !request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (request.status !== 'pending') {
      return NextResponse.json({ error: 'Request already processed' }, { status: 400 });
    }

    let updateData: {
      status: string;
      coach_response: string;
      processed_at: string;
      refund_amount?: number;
      counter_offer_plan_id?: string;
    } = {
      status: action,
      coach_response: response,
      processed_at: new Date().toISOString()
    };

    // Handle different actions
    if (action === 'approved') {
      // Cancel the Stripe subscription
      await stripe.subscriptions.update(request.subscription_id, {
        cancel_at_period_end: true
      });

      if (refundAmount && refundAmount > 0) {
        // Process prorated refund
        const refund = await stripe.refunds.create({
          charge: (await stripe.subscriptions.retrieve(request.subscription_id)).latest_invoice as string,
          amount: Math.round(refundAmount * 100)
        });
        updateData.refund_amount = refundAmount;
      }
    } else if (action === 'countered' && counterOfferPlanId) {
      updateData.counter_offer_plan_id = counterOfferPlanId;
    }

    // Update the request
    const { data: updatedRequest, error: updateError } = await supabase
      .from('cancellation_requests')
      .update(updateData)
      .eq('id', params.requestId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ request: updatedRequest });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
