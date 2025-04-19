'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { getStripe } from '@/lib/stripe/client';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react'; // For loading state
import { toast } from 'sonner'; // For error messages

// Define Plan type matching coach_plans structure
type PricingPlan = {
  id: string; // Plan UUID
  coach_id: string;
  stripe_product_id: string;
  stripe_price_id: string;
  name: string;
  description: string | null;
  price: number; // In cents
  currency: string;
  interval: 'day' | 'week' | 'month' | 'year';
  interval_count: number;
  features: string[] | null;
  is_active: boolean;
  is_publicly_featured?: boolean;
};

// Define Coach Profile type (only needed fields)
type CoachProfile = {
    id: string;
    stripe_account_id: string | null;
};

// TEMPORARY: Use the test coach ID for now until Empower Coach is fully set up
const TEST_COACH_ID = 'b7a768b0-b0d2-4d0d-81f2-8628ceeae178'; 
// const EMPOWER_COACH_ID = 'cc9a7743-e14e-4233-ab86-9b95e1339fc4'; // Define the default coach ID

export default function PricingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubscribing, setIsSubscribing] = useState<string | null>(null);
  const [coachStripeId, setCoachStripeId] = useState<string | null>(null); // Renamed state

  useEffect(() => {
    const fetchFeaturedPlans = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch Test Coach's Stripe Account ID first
        const { data: coachProfile, error: coachError } = await supabase
            .from('profiles')
            .select('id, stripe_account_id')
            .eq('id', TEST_COACH_ID) // Use TEST_COACH_ID
            .eq('role', 'coach')
            .single();

        if (coachError) throw new Error(`Failed to fetch Test Coach profile: ${coachError.message}`);
        if (!coachProfile?.stripe_account_id) throw new Error('Test Coach Stripe account is not connected.');
        
        setCoachStripeId(coachProfile.stripe_account_id); // Set the correct state variable

        // Fetch active and featured plans for Test Coach
        const { data: planData, error: planError } = await supabase
          .from('coach_plans')
          .select('*')
          .eq('coach_id', TEST_COACH_ID) // Use TEST_COACH_ID
          .eq('is_active', true)
          .eq('is_publicly_featured', true) 
          .order('price', { ascending: true }); // Example ordering

        if (planError) throw planError;
        setPlans(planData || []);

      } catch (err: any) {
        console.error("Error fetching featured plans:", err);
        setError(err.message);
        toast.error("Error loading plans", { description: err.message });
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeaturedPlans();
  }, [supabase]);

  const handleSubscribe = async (plan: PricingPlan) => {
    setIsSubscribing(plan.stripe_price_id); // Set loading state for this specific button
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Store selected price ID and redirect to signup
      // Pass necessary info for post-signup purchase
      router.push(`/signup?priceId=${plan.stripe_price_id}&coachId=${plan.coach_id}`);
      return;
    }

    // User is logged in, proceed to checkout
    if (!coachStripeId) { // Check the correct state variable
        toast.error("Coach's Stripe account not configured.");
        setIsSubscribing(null);
        return;
    }

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: plan.stripe_price_id,
          userId: user.id, 
          coachStripeAccountId: coachStripeId, // Use the correct state variable
          planId: plan.id 
        }),
      });

      if (!response.ok) {
         const errorData = await response.json();
         throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { sessionId } = await response.json();
      const stripe = await getStripe();
      if (stripe) {
        const { error: stripeError } = await stripe.redirectToCheckout({ sessionId });
        if (stripeError) {
            console.error('Stripe redirect error:', stripeError);
            toast.error("Stripe Error", { description: stripeError.message });
        }
      } else {
        console.error('Stripe.js has not loaded yet.');
        toast.error("Could not connect to Stripe. Please try again.");
      }
    } catch (error: any) {
      console.error('Subscription error:', error);
      toast.error("Subscription Error", { description: error.message });
    } finally {
      setIsSubscribing(null); // Clear loading state
    }
  };

  // Helper to format interval
  const formatInterval = (interval: string, count: number) => {
    if (count === 1) return `/${interval}`;
    return `/ ${count} ${interval}s`;
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-8 text-center">Choose Your Plan</h1>

      {isLoading && (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {error && !isLoading && (
         <p className="text-center text-red-500">{error}</p>
      )}

      {!isLoading && !error && plans.length === 0 && (
         <p className="text-center text-muted-foreground">No featured plans available at this time.</p>
      )}

      {!isLoading && !error && plans.length > 0 && (
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div key={plan.id} className="border rounded-lg p-6 flex flex-col shadow-sm hover:shadow-md transition-shadow">
              <h2 className="text-xl font-semibold mb-2">{plan.name}</h2>
              {plan.description && <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>}
              <p className="text-3xl font-bold my-4">
                ${(plan.price / 100).toFixed(2)}
                <span className="text-sm font-normal text-muted-foreground">{formatInterval(plan.interval, plan.interval_count)}</span>
              </p>
              <ul className="space-y-2 mb-6 flex-grow">
                {plan.features?.map((feature, index) => (
                  <li key={index} className="text-sm flex items-center">
                     <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                     {feature}
                  </li>
                ))}
                 {!plan.features && <li className="text-sm text-muted-foreground italic">No specific features listed.</li>}
              </ul>
              <Button
                onClick={() => handleSubscribe(plan)}
                className="w-full mt-auto"
                disabled={isSubscribing === plan.stripe_price_id}
              >
                {isSubscribing === plan.stripe_price_id ? (
                   <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                   'Get Started'
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
