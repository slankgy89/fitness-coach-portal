'use client'; // Mark this as a Client Component

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function AuthMessages() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Get initial messages from URL
  const initialError = searchParams.get('error');
  const initialSuccess = searchParams.get('message');

  // State to control visibility
  const [visibleError, setVisibleError] = useState<string | null>(initialError);
  const [visibleSuccess, setVisibleSuccess] = useState<string | null>(initialSuccess);

  useEffect(() => {
    // Only run the timeout logic if there was an initial message
    if (initialError || initialSuccess) {
      const timer = setTimeout(() => {
        // Hide the messages in the component state
        setVisibleError(null);
        setVisibleSuccess(null);

        // Remove the query parameters from the URL without reloading the page
        router.replace(pathname, { scroll: false });

      }, 3000); // 3 seconds timeout

      // Cleanup timer if component unmounts or params change before timeout
      return () => clearTimeout(timer);
    }
    // Intentionally only run this effect when the component mounts
    // or when the initial URL parameters change (which shouldn't happen often without a reload)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialError, initialSuccess, router, pathname]);

  // Effect to update visible state if URL params change *after* initial load
  // (e.g., due to client-side navigation that adds params without full reload)
  useEffect(() => {
      setVisibleError(initialError);
      setVisibleSuccess(initialSuccess);
  }, [initialError, initialSuccess]);


  return (
    <>
      {visibleError && ( // Display based on state
        <p className="mb-4 rounded-md bg-destructive/20 p-3 text-center text-sm text-destructive">
          {/* Decode the error message from URL if needed */}
          {decodeURIComponent(visibleError)}
        </p>
      )}
      {visibleSuccess && ( // Display based on state
        <p className="mb-4 rounded-md bg-green-500/20 p-3 text-center text-sm text-green-500">
          {visibleSuccess}
        </p>
      )}
    </>
  );
}
