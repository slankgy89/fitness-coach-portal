'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SuccessPage() {
  const router = useRouter();
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const checkSubscription = async () => {
      try {
        // Get user session
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          throw new Error('User not found');
        }

        // Poll for subscription status
        const pollInterval = setInterval(async () => {
          const { data: subscription } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .in('status', ['trialing', 'active'])
            .maybeSingle();

          if (subscription) {
            clearInterval(pollInterval);
            setStatus('success');
            router.push('/dashboard');
          }
        }, 1000); // Check every second

        // Timeout after 30 seconds
        const timeoutId = setTimeout(() => {
          clearInterval(pollInterval);
          setStatus('timeout');
          setError('Subscription processing is taking longer than expected. Please check back later.');
        }, 30000);

        return () => {
          clearInterval(pollInterval);
          clearTimeout(timeoutId);
        };
      } catch (err) {
        setStatus('error');
        setError('Failed to verify subscription. Please contact support.');
        console.error('Subscription verification error:', err);
      }
    };

    checkSubscription();
  }, [router, supabase]);

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 text-center">
      <h1 className="text-3xl font-bold mb-4">
        {status === 'processing' ? 'Processing Subscription...' :
         status === 'success' ? 'Subscription Confirmed!' :
         'Subscription Issue'}
      </h1>
      
      {status === 'processing' && (
        <div className="flex flex-col items-center">
          <p className="text-lg mb-4 text-muted-foreground">
            Verifying your subscription details...
          </p>
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-md">
          <p>{error}</p>
          <button
            onClick={() => router.push('/our-plans')}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Back to Plans
          </button>
        </div>
      )}
    </div>
  );
}
