import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { checkSubscriptionStatus } from '@/lib/supabase/server'; // Import the helper

// Define protected routes that require a subscription or active coach
const protectedRoutes = ['/dashboard', '/coach', '/client']; 
// Define routes accessible only when logged out
const authRoutes = ['/login', '/signup'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Create Supabase client for middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  console.log(`[Middleware] Pathname: ${pathname}`);

  // Get user session
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError) {
    console.error('[Middleware] User Error:', userError.message);
    // Allow access but log error, might need better handling
  }
  console.log(`[Middleware] User authenticated: ${!!user}`);

  // --- Redirect Logic ---

  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  // 1. Redirect logged-in users away from auth pages
  if (user && isAuthRoute) {
    const priceId = request.nextUrl.searchParams.get('priceId');
    if (priceId) {
      console.log('[Middleware] Logged-in user on auth page with priceId, redirecting to checkout...');
      return NextResponse.redirect(new URL(`/checkout?priceId=${priceId}`, request.url));
    } else {
      console.log('[Middleware] Logged-in user on auth page, redirecting to dashboard...');
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // 2. Protect routes if user is not logged in
  if (!user && isProtectedRoute) {
     console.log('[Middleware] No user found for protected route, redirecting to login...');
     const redirectUrl = request.nextUrl.clone();
     redirectUrl.pathname = '/login';
     redirectUrl.searchParams.set('redirect_to', pathname);
     return NextResponse.redirect(redirectUrl);
  }

  // 3. Subscription/Access checks for logged-in users on protected routes
  if (user && isProtectedRoute && pathname !== '/success') {
    console.log('[Middleware] Checking subscription/access for protected route...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, client_type, coach_id')
      .eq('id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') { // Allow row not found initially? Maybe not.
      console.error('[Middleware] Error fetching profile:', profileError);
      return NextResponse.redirect(new URL('/error?message=profile-fetch-error', request.url)); // Redirect to a generic error page
    }
     if (!profile) {
       console.error(`[Middleware] Profile not found for user ${user.id}, redirecting to login.`);
       // If profile doesn't exist even though user does, something is wrong, force login/re-auth
       const redirectUrl = request.nextUrl.clone();
       redirectUrl.pathname = '/login';
       return NextResponse.redirect(redirectUrl);
     }


    const role = profile.role;
    const clientType = profile.client_type;
    const coachId = profile.coach_id;
    let allowAccess = false;

    if (role === 'coach') {
      console.log('[Middleware] User is Coach, checking own subscription...');
      allowAccess = await checkSubscriptionStatus(user.id);
    } else if (role === 'client') {
      if (clientType === 'direct') {
        console.log('[Middleware] User is Direct Client, checking own subscription...');
        allowAccess = await checkSubscriptionStatus(user.id);
      } else if (clientType === 'managed') {
        console.log('[Middleware] User is Managed Client, checking coach subscription...');
        if (coachId) {
          allowAccess = await checkSubscriptionStatus(coachId);
        } else {
          console.warn(`[Middleware] Managed client ${user.id} has no coach_id assigned.`);
          // allowAccess = false; // No coach assigned, deny access - REMOVED
          allowAccess = true; // Allow access if no coach is assigned
        }
      } else {
         console.warn(`[Middleware] Client ${user.id} has unknown client_type: ${clientType}`);
         allowAccess = false; // Unknown type, deny access
      }
    } else {
        console.log(`[Middleware] User role is ${role}, allowing access by default.`);
        allowAccess = true; // Allow other roles by default
    }

    console.log(`[Middleware] Access allowed based on role/subscription check: ${allowAccess}`);

    // --- Decision Logic ---
    // If access check failed for a protected route (excluding dashboard), redirect to /our-plans
    if (!allowAccess && pathname !== '/dashboard') {
        console.log('[Middleware] Access denied (non-dashboard), redirecting to /our-plans...');
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = '/our-plans';
        return NextResponse.redirect(redirectUrl);
    } else if (!allowAccess) {
        console.log('[Middleware] Access denied for dashboard, allowing to proceed to show message.');
    }
    // If access check passed, allow proceeding
    console.log('[Middleware] Access granted, allowing request to proceed.');

  } // End of subscription check block

  // Rule 4 REMOVED - Allow direct access to signup now
  // if (pathname === '/signup' && !request.nextUrl.searchParams.has('priceId')) {
  //     console.log('[Middleware] Direct signup access blocked, redirecting to pricing...');
  //     return NextResponse.redirect(new URL('/pricing', request.url));
  // }

  // --- Allow request if not redirected ---
  console.log('[Middleware] Allowing request to proceed.');
  return response;
}

// Config matcher remains the same
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
