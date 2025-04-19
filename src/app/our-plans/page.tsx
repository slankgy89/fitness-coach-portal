'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { getStripe } from '@/lib/stripe/client';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Re-use the Plan type (consider moving to shared types file)
type CoachPlan = {
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

// Define Profile type (only needed fields)
type ClientProfile = {
    id: string;
    coach_id: string | null; // Client's assigned coach
    // We also need the coach's stripe_account_id for checkout
    profiles: { // Assuming a relationship named 'profiles' links to the coach's profile
        id: string;
        stripe_account_id: string | null;
    } | null;
};


export default function OurPlansPage() {
  const router = useRouter();
  const supabase = createClient();
  const [plans, setPlans] = useState<CoachPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubscribing, setIsSubscribing] = useState<string | null>(null);
  const [assignedCoachStripeId, setAssignedCoachStripeId] = useState<string | null>(null);
  const [assignedCoachId, setAssignedCoachId] = useState<string | null>(null);

  useEffect(() => {
    const fetchClientAndPlans = async () => {
      setIsLoading(true);
      setError(null);
      let coachId: string | null = null;
      let coachStripeId: string | null = null;

      try {
        // 1. Get current user and their assigned coach_id + coach's stripe_id
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) throw new Error('Not authenticated');

        // Step 1: Get the client's profile to find their assigned coach_id
        const { data: clientProfile, error: clientProfileError } = await supabase
            .from('profiles')
            .select('coach_id')
            .eq('id', user.id)
            .single();

        if (clientProfileError) throw new Error(`Failed to fetch client profile: ${clientProfileError.message}`);
        if (!clientProfile?.coach_id) throw new Error('No coach assigned to this client.');

        coachId = clientProfile.coach_id;
        setAssignedCoachId(coachId); // Store coach ID

        // Step 2: Get the assigned coach's profile to find their stripe_account_id
        console.log(`[Our Plans] Fetching profile for assigned coach: ${coachId}`);
        const { data: coachProfile, error: coachProfileError } = await supabase
            .from('profiles')
            .select('id, stripe_account_id')
            .eq('id', coachId)
            .eq('role', 'coach') // Ensure it's actually a coach profile
            .single();
        
        if (coachProfileError) throw new Error(`Failed to fetch assigned coach profile: ${coachProfileError.message}`);
        if (!coachProfile) throw new Error(`Assigned coach profile not found (ID: ${coachId}).`);
        if (!coachProfile.stripe_account_id) {
            console.error(`[Our Plans] Assigned coach ${coachId} is missing stripe_account_id.`);
            throw new Error('Assigned coach has not connected their Stripe account.');
        }

        coachStripeId = coachProfile.stripe_account_id;
        setAssignedCoachStripeId(coachStripeId); // Store coach's Stripe ID

        // 2. Fetch active plans for the assigned coach
        const { data: planData, error: planError } = await supabase
          .from('coach_plans')
          .select('*')
          .eq('coach_id', coachId) // Filter by assigned coach
          .eq('is_active', true)   // Only active plans
          .order('price', { ascending: true });

        if (planError) throw planError;
        setPlans(planData || []);

      } catch (err: any) {
        console.error("Error fetching assigned coach plans:", err);
        setError(err.message);
        // Don't use toast here as it might be shown before component mounts fully
      } finally {
        setIsLoading(false);
      }
    };

    fetchClientAndPlans();
  }, [supabase]);

  const handleSubscribe = async (plan: CoachPlan) => {
    setIsSubscribing(plan.stripe_price_id);
    const { data: { user } } = await supabase.auth.getUser(); // Re-check user just in case

     if (!user) {
       router.push(`/login?redirect_to=/our-plans`); // Should ideally not happen if page loaded
       return;
     }

    if (!assignedCoachStripeId) {
        toast.error("Assigned coach's Stripe account not configured.");
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
          coachStripeAccountId: assignedCoachStripeId, // Use the assigned coach's Stripe ID
          planId: plan.id,
        }),
      });
      console.log(`[Our Plans] handleSubscribe - priceId: ${plan.stripe_price_id}, userId: ${user.id}, coachStripeAccountId: ${assignedCoachStripeId}, planId: ${plan.id}`);

      if (!response.ok) {
         const errorData = await response.json();
         throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { sessionId } = await response.json();
      // Pass the coach's connected account ID to getStripe
      const stripe = await getStripe(assignedCoachStripeId); 
      if (stripe) {
        // No need to pass stripeAccount here, as stripe object is already initialized with it
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
      setIsSubscribing(null);
    }
  };

  // Helper to format interval (same as pricing page)
  const formatInterval = (interval: string, count: number) => {
    if (count === 1) return `/${interval}`;
    return `/ ${count} ${interval}s`;
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-2 text-center">Our Plans</h1>
      <p className="text-center text-muted-foreground mb-8">Select a plan from your assigned coach to get started.</p>

      {isLoading && (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {error && !isLoading && (
         <p className="text-center text-red-500">{error}</p>
      )}

      {!isLoading && !error && plans.length === 0 && (
         <p className="text-center text-muted-foreground">Your assigned coach currently has no active plans available.</p>
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
                   'Subscribe' // Changed button text
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
