'use client'; // Needs client-side interaction for button click and redirect

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link'; // Import Link
import { createClient } from '@/lib/supabase/client';
import { Button, buttonVariants } from '@/components/ui/button'; // Import buttonVariants
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"; // Import Tooltip components

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [connectStatus, setConnectStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  // Check for status messages from redirects
  useEffect(() => {
    const stripeConnectParam = searchParams.get('stripe_connect');
    const errorMessage = searchParams.get('error_message');
    if (stripeConnectParam === 'success') {
      setConnectStatus('success');
      // Optionally clear query params
      // router.replace('/coach/settings', { scroll: false }); 
    } else if (stripeConnectParam === 'error') {
      setError(errorMessage || 'An unknown error occurred during Stripe connection.');
      setConnectStatus('error');
      // Optionally clear query params
      // router.replace('/coach/settings', { scroll: false });
    }
  }, [searchParams, router]);

  // Fetch profile on load
   useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('stripe_account_id')
          .eq('id', user.id)
          .single();
        
        if (profileError) {
          console.error("Error fetching profile:", profileError);
          setError("Could not load profile data.");
        } else if (profile) {
          setStripeAccountId(profile.stripe_account_id);
          // TODO: Add check to Stripe API to get actual account status (requires_action, active etc.)
        }
      } else {
         router.push('/login'); // Should be handled by middleware, but good fallback
      }
    };
    fetchProfile();
  }, [supabase, router]);


  const handleConnectStripe = async () => {
    setIsLoading(true);
    setError(null);
    setConnectStatus('loading');
    try {
      const response = await fetch('/api/stripe/connect-account', {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error?.message || 'Failed to initiate Stripe connection.');
      }

      if (data.url) {
        // Redirect user to Stripe onboarding
        window.location.href = data.url;
      } else {
        throw new Error('Could not retrieve Stripe onboarding URL.');
      }
    } catch (err: any) {
      console.error('Stripe Connect Error:', err);
      setError(err.message);
      setConnectStatus('error');
      setIsLoading(false);
    }
    // No need to set isLoading false if redirecting
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Coach Settings</h1>
      
      <div className="space-y-4 p-6 border rounded-lg bg-card">
         <h2 className="text-xl font-semibold text-card-foreground">Stripe Connection</h2>
         
         {connectStatus === 'success' && (
            <p className="text-green-500">Stripe account connected successfully!</p>
         )}
         {connectStatus === 'error' && (
            <p className="text-red-500">Error connecting Stripe: {error}</p>
         )}

         {stripeAccountId ? (
           <div>
              <p className="text-muted-foreground">Your Stripe account is connected.</p>
              <p className="text-sm text-muted-foreground mb-4">Account ID: {stripeAccountId}</p>
              {/* TODO: Add button to view Stripe dashboard or manage connection */}
              {/* TODO: Display actual connection status from Stripe API */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href="/dashboard"
                      className={buttonVariants({ variant: 'outline', size: 'sm' })}
                    >
                      Back to Dashboard
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Click here to go back to Dashboard</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          ) : (
            <div>
             <p className="text-muted-foreground mb-4">
               Connect your Stripe account to receive payments directly from clients and manage your subscription plans.
             </p>
             <Button onClick={handleConnectStripe} disabled={isLoading}>
               {isLoading ? 'Connecting...' : 'Connect Stripe Account'}
             </Button>
           </div>
         )}
      </div>

      {/* Add other settings sections later */}
    </div>
  );
}


export default function CoachSettingsPage() {
  // Wrap with Suspense because useSearchParams needs it
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading Settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
