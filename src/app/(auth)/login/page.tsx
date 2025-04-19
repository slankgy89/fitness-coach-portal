import Link from 'next/link';
import { login } from '@/app/(auth)/actions';
import AuthMessages from '@/app/(auth)/AuthMessages';
import { Suspense } from 'react'; // Import Suspense

// Define the props type for the Page component
interface LoginPageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

// Define the props type for the LoginForm component
interface LoginFormProps {
  priceId: string;
  finalRedirectTo: string;
}

// LoginForm component now receives derived props
function LoginForm({ priceId, finalRedirectTo }: LoginFormProps) {
  return (
    // Use React Fragment <>...</> as the root element for LoginForm
    <>
      <h1 className="text-center text-2xl font-bold text-card-foreground">
        Login to Your Portal
      </h1>
      <AuthMessages />
      <form className="space-y-6" action={login}>
        {/* Pass the determined redirect path */}
        <input type="hidden" name="redirect_to" value={finalRedirectTo} />
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-muted-foreground">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-muted-foreground">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
        >
          Sign in
        </button>
      </form>
      {/* Only show signup link if user didn't arrive here with a priceId (meaning they didn't start from pricing) */}
      {!priceId && (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Don't have an account?{' '}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Sign up
          </Link>
        </p>
      )}
    </> // Closing React Fragment
  );
}

// Main page component reads searchParams and passes derived values to LoginForm
export default function LoginPage({ searchParams }: LoginPageProps) {
  // Read params here, in the Page component
  const priceId = typeof searchParams.priceId === 'string' ? searchParams.priceId : '';
  const redirectToParam = typeof searchParams.redirect_to === 'string' ? searchParams.redirect_to : '/dashboard';
  // Determine final redirect: checkout if priceId exists, otherwise use redirect_to param or dashboard
  const finalRedirectTo = priceId ? `/checkout?priceId=${priceId}` : redirectToParam;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-card p-8 shadow-lg">
        <Suspense fallback={<div className="text-center">Loading...</div>}> {/* Suspense boundary */}
          {/* Pass derived values as props */}
          <LoginForm priceId={priceId} finalRedirectTo={finalRedirectTo} />
        </Suspense>
      </div>
    </div>
  );
}
