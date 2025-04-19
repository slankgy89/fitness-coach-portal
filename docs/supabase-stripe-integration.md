# Supabase & Stripe Integration Guide for Next.js

## Table of Contents
1. [Supabase Setup](#supabase-setup)
2. [Authentication](#authentication)
3. [Database Usage](#database-usage)
4. [Stripe Integration](#stripe-integration)
5. [Subscription Flows](#subscription-flows)
6. [Combined Implementation](#combined-implementation)
7. [References](#references)

## Supabase Setup

### Official Documentation
- [Next.js Quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [App Router Integration](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)

### Key Steps:
1. Install required packages:
```bash
npm install @supabase/supabase-js @supabase/ssr
```

2. Configure environment variables:
```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

3. Create client utilities (see `src/lib/supabase/client.ts` in your project)

## Authentication

### Resources:
- [Next.js Auth Quickstart](https://supabase.com/docs/guides/auth/quickstarts/nextjs)
- [Server-Side Auth](https://supabase.com/docs/guides/auth/server-side/nextjs)

### Implementation Notes:
- Use `createServerComponentClient` for server components
- Implement auth state management with cookies
- Consider using middleware for route protection

## Database Usage

### Best Practices:
- Enable Row Level Security (RLS)
- Create appropriate policies
- Use TypeScript types from `database.types.ts`

## Stripe Integration

### Official Documentation:
- [Subscriptions Overview](https://stripe.com/docs/billing/subscriptions/overview)
- [Trial Periods](https://stripe.com/docs/billing/subscriptions/trials)

### Key Packages:
```bash
npm install stripe @stripe/stripe-js
```

### Environment Variables:
```env
STRIPE_SECRET_KEY=your-stripe-secret-key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your-publishable-key
```

## Subscription Flows

### Free Trial Implementation:
1. Create products with trial periods in Stripe Dashboard
2. Implement checkout flow:
```javascript
const session = await stripe.checkout.sessions.create({
  payment_method_types: ['card'],
  line_items: [{
    price: 'price_123', // Your price ID
    quantity: 1,
  }],
  mode: 'subscription',
  subscription_data: {
    trial_period_days: 14, // 14-day free trial
  },
  success_url: `${req.headers.origin}/success`,
  cancel_url: `${req.headers.origin}/cancel`,
});
```

## Combined Implementation

### Recommended Patterns:
1. Store Stripe customer IDs in Supabase
2. Sync subscription status via webhooks
3. Implement role-based access based on subscription status

### Example Repositories:
- [next-supabase-stripe-starter](https://github.com/KolbySisk/next-supabase-stripe-starter)
- [Medium Article](https://medium.com/@ojasskapre/implementing-stripe-subscriptions-with-supabase-next-js-and-fastapi-666e1aada1b5)

## References
- [Supabase Docs](https://supabase.com/docs)
- [Stripe Docs](https://stripe.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
