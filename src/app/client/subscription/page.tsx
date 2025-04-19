'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CancelRequestForm } from '@/app/client/cancel-request/CancelRequestForm'; // Assuming path
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

type SubscriptionDetails = {
  id: string; // Stripe Subscription ID
  status: string;
  current_period_end: number; // Timestamp
  plan_name: string;
  price: number; // In cents
  currency: string;
  interval: string;
  interval_count: number;
  cancellation_request_status?: string; // Status from our cancellation_requests table
};

export default function ClientSubscriptionPage() {
  const supabase = createClient();
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubscription = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // 1. Get user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) throw new Error('Not authenticated');

        // 2. Get active subscription from subscriptions table
        //    (Assuming only one active subscription per client for now)
        const { data: subData, error: subError } = await supabase
          .from('subscriptions') // Corrected table name
          .select('id, status, current_period_end, plan_name') // Corrected column name
          .eq('user_id', user.id)
          .in('status', ['active', 'trialing']) // Only fetch active/trialing subs
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (subError && subError.code !== 'PGRST116') { // Ignore 'No rows found' error
             throw subError;
        }
        if (!subData) {
            // No active subscription found
            setSubscription(null);
            setIsLoading(false);
            return;
        }


        // 3. Get plan details from coach_plans table
        const { data: planData, error: planError } = await supabase
          .from('coach_plans')
          .select('name, price, currency, interval, interval_count')
          .eq('id', subData.plan_id)
          .single();

        if (planError) throw planError;
        if (!planData) throw new Error('Plan details not found');

        // 4. Check for existing cancellation request
         const { data: requestData, error: requestError } = await supabase
           .from('cancellation_requests')
           .select('status')
           .eq('subscription_id', subData.id)
           .order('requested_at', { ascending: false })
           .limit(1)
           .maybeSingle(); // Use maybeSingle as request might not exist

         if (requestError) throw requestError;


        // 5. Combine data
        setSubscription({
          id: subData.id,
          status: subData.status,
          current_period_end: subData.current_period_end,
          plan_name: planData.name,
          price: planData.price,
          currency: planData.currency,
          interval: planData.interval,
          interval_count: planData.interval_count,
          cancellation_request_status: requestData?.status,
        });

      } catch (err: any) {
        console.error("Error fetching subscription:", err);
        setError(err.message || 'Failed to load subscription details.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubscription();
  }, [supabase]);

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">My Subscription</h1>

      {isLoading && (
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )}
      {error && <p className="text-red-500">{error}</p>}

      {!isLoading && !error && !subscription && (
        <p className="text-muted-foreground">You do not have an active subscription.</p>
        // TODO: Add link to store page?
      )}

      {!isLoading && !error && subscription && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
                <CardTitle>{subscription.plan_name}</CardTitle>
                <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>
                    {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              ${(subscription.price / 100).toFixed(2)} {subscription.currency.toUpperCase()} /
              {subscription.interval_count > 1 ? ` ${subscription.interval_count}` : ''} {subscription.interval}{subscription.interval_count > 1 ? 's' : ''}
            </p>
             <p className="text-sm text-muted-foreground">
                Renews on: {format(new Date(subscription.current_period_end * 1000), 'MMM d, yyyy')}
             </p>
          </CardHeader>
          <CardContent>
            {/* Cancellation Section */}
            {subscription.cancellation_request_status === 'pending' && (
                <p className="text-orange-600 font-medium">Cancellation request pending approval.</p>
            )}
             {subscription.cancellation_request_status === 'approved' && (
                <p className="text-green-600 font-medium">Cancellation approved. Access ends {format(new Date(subscription.current_period_end * 1000), 'MMM d, yyyy')}.</p>
            )}
             {subscription.cancellation_request_status === 'denied' && (
                <p className="text-red-600 font-medium">Cancellation request denied. Please contact your coach.</p>
                // TODO: Show coach response?
            )}

            {/* Show form only if status is active/trialing and no pending/approved request */}
            {(subscription.status === 'active' || subscription.status === 'trialing') &&
             (!subscription.cancellation_request_status || subscription.cancellation_request_status === 'denied') && (
                <div className="mt-6 pt-6 border-t">
                    <CancelRequestForm subscriptionId={subscription.id} />
                </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
