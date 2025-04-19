'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getStripe } from '@/lib/stripe/client';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initiateCheckout = async () => {
      setIsLoading(true);
      setError(null);

      // Primarily use searchParams, fallback to localStorage only if needed
      const priceIdFromUrl = searchParams.get('priceId');
      const priceIdFromStorage = localStorage.getItem('selectedPriceId');
      const priceId = priceIdFromUrl || priceIdFromStorage; 
      
      if (!priceId) {
        setError('No price ID found. Please select a plan.');
        setIsLoading(false);
        // Optionally redirect back to pricing
        // router.push('/pricing'); 
        return;
      }

      // Clear stored price ID if it was used
      // Clear stored price ID if it exists
      if (priceIdFromStorage) {
        localStorage.removeItem('selectedPriceId'); 
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        setError('You must be logged in to proceed.');
        setIsLoading(false);
        // Redirect to login, potentially passing this page as redirect_to
        router.push(`/login?redirect_to=${encodeURIComponent(`/checkout?priceId=${priceId}`)}`);
        return;
      }

      try {
        const response = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            priceId,
            customerEmail: user.email,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Failed to create checkout session');
        }

        const { sessionId } = await response.json();
        const stripe = await getStripe();

        if (stripe) {
          const { error: stripeError } = await stripe.redirectToCheckout({ sessionId });
          if (stripeError) {
            console.error('Stripe redirect error:', stripeError);
            setError(stripeError.message || 'Failed to redirect to Stripe.');
          }
          // If redirect is successful, the user leaves this page.
          // If it fails, we fall through and set loading to false.
        } else {
          setError('Stripe.js has not loaded yet.');
        }
      } catch (err: any) {
        console.error('Checkout initiation error:', err);
        setError(err.message || 'An unexpected error occurred.');
      } finally {
        // Only set loading false if not redirecting
        if (error) setIsLoading(false); 
      }
    };

    initiateCheckout();
  }, [searchParams, router, supabase]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading checkout...</div>;
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-screen text-red-500">
        <p>Error: {error}</p>
        <button onClick={() => router.push('/pricing')} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">
          Go back to Pricing
        </button>
      </div>
    );
  }

  // Should ideally not reach here if redirect is successful
  return <div className="flex justify-center items-center h-screen">Redirecting to Stripe...</div>;
}


export default function CheckoutPage() {
  // Wrap with Suspense because useSearchParams needs it
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
