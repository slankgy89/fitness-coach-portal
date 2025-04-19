// Keep imports needed for both components
import SignupForm from '@/components/SignupForm';

// Define props for the Page component
interface SignupPageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

// Main Page component (Server Component) reads searchParams and renders SignupForm
export default function SignupPage({ searchParams }: SignupPageProps) {
  // Read searchParams and calculate derived values here
  const priceId = typeof searchParams.priceId === 'string' ? searchParams.priceId : '';
  const loginRedirectTo = priceId ? `/checkout?priceId=${priceId}` : '/dashboard'; // Default to dashboard if no priceId
  const loginUrl = `/login?redirect_to=${encodeURIComponent(loginRedirectTo)}`;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-card p-8 shadow-lg">
        {/* Render the client component directly */}
        <SignupForm priceId={priceId} loginUrl={loginUrl} />
      </div>
    </div>
  );
}
