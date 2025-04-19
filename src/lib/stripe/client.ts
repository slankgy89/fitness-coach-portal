import { loadStripe, Stripe } from '@stripe/stripe-js';

// Cache Stripe promises based on account ID (or lack thereof for platform)
const stripePromiseCache: { [key: string]: Promise<Stripe | null> } = {};

export const getStripe = (connectedAccountId?: string): Promise<Stripe | null> => {
  const cacheKey = connectedAccountId || 'platform'; // Use 'platform' as key for the main account

  if (!stripePromiseCache[cacheKey]) {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      console.error('Stripe publishable key is not set in environment variables.');
      return Promise.resolve(null); // Return null promise if key is missing
    }

    // Pass the connectedAccountId to loadStripe if provided
    stripePromiseCache[cacheKey] = loadStripe(
      publishableKey,
      connectedAccountId ? { stripeAccount: connectedAccountId } : undefined
    );
  }
  return stripePromiseCache[cacheKey];
};
