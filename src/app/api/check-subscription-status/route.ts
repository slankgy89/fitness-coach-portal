import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server'; // Use server client for auth check

export async function GET(request: Request) {
  const supabase = createClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('Check Subscription API: Auth error or no user', userError);
      return NextResponse.json({ isActive: false, error: 'Authentication required.' }, { status: 401 });
    }

    // Check for an active subscription for this user
    // We consider 'active' or 'trialing' as valid states allowing access
    const { data: subscription, error: dbError } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing']) // Check for active or trialing status
      .maybeSingle(); // Use maybeSingle as user might not have a subscription yet

    if (dbError) {
      console.error('Check Subscription API: Database error', dbError);
      return NextResponse.json({ isActive: false, error: 'Database error checking subscription.' }, { status: 500 });
    }

    const isActive = !!subscription; // True if a subscription with status 'active' or 'trialing' was found
    console.log(`Check Subscription API: User ${user.id}, Active: ${isActive}`);

    return NextResponse.json({ isActive });

  } catch (error: any) {
    console.error('Check Subscription API: Unexpected error', error);
    return NextResponse.json({ isActive: false, error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
