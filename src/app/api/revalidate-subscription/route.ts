import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const { userId, secret } = await request.json();

  // Verify the secret
  if (secret !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  const supabase = createClient();

  try {
    // Get the latest subscription status
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['trialing', 'active'])
      .maybeSingle();

    if (!subscription) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true,
      subscriptionStatus: subscription.status 
    });
  } catch (error) {
    console.error('Revalidation error:', error);
    return NextResponse.json({ error: 'Failed to revalidate subscription' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
