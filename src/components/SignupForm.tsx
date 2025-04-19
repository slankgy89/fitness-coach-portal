'use client';

import Link from 'next/link';
import { signup } from '@/app/(auth)/actions';
import AuthMessages from '@/app/(auth)/AuthMessages';
import { useState } from 'react';

// Define props for the inner client component
interface SignupFormProps {
  priceId: string;
  loginUrl: string;
}

// Inner Client Component for the form and state
export default function SignupForm({ priceId, loginUrl }: SignupFormProps) {
  const [selectedRole, setSelectedRole] = useState('client'); // State for selected role

  return (
    <> {/* Use fragment */}
      <h1 className="text-center text-2xl font-bold text-card-foreground">
        Create Your Account
      </h1>
      {/* Add welcoming message */}
      <p className="text-center text-muted-foreground">
        Awesome! Let's get you set up to start your fitness journey! Create your account below.
      </p>
      {/* Render the AuthMessages component directly */}
      <AuthMessages />
      <form className="space-y-6" action={signup}>
        {/* Add hidden input for priceId */}
        <input type="hidden" name="priceId" value={priceId} />
        {/* Add First Name and Last Name fields */}
          <div className="flex space-x-4">
            <div className="flex-1">
              <label htmlFor="firstName" className="block text-sm font-medium text-muted-foreground">
                First Name
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                required
                className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                placeholder="Your"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="lastName" className="block text-sm font-medium text-muted-foreground">
                Last Name
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                required
                className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                placeholder="Name"
              />
            </div>
          </div>
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
              autoComplete="new-password"
              required
              minLength={6} // Supabase default minimum password length
              className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
              placeholder="••••••••"
            />
             <p className="mt-1 text-xs text-muted-foreground">Minimum 6 characters.</p>
          </div>
          {/* Add Role Selection (Client/Coach) */}
           <div>
            <label htmlFor="role" className="block text-sm font-medium text-muted-foreground">
              Account Type
            </label>
            <select
              id="role"
              name="role"
              required
              value={selectedRole} // Control the select value with state
              onChange={(e) => setSelectedRole(e.target.value)} // Update state on change
              className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
            >
              <option value="client">Client</option>
              <option value="coach">Coach</option>
            </select>
          </div>

          {/* Conditionally render Coach ID input for Clients */}
          {selectedRole === 'client' && (
            <div>
              <label htmlFor="coachSearchId" className="block text-sm font-medium text-muted-foreground">
                Coach ID (Optional - starts with EMPH)
              </label>
              <input
                id="coachSearchId"
                name="coachSearchId" // Name used in server action
                type="text"
                className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 placeholder-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                placeholder="Enter coach's EMPH ID (optional)"
                // Add pattern validation if desired: pattern="^EMPH[A-Z0-9]{6}$"
              />
               <p className="mt-1 text-xs text-muted-foreground">
                 If you don't have a Coach ID, you'll be assigned to Empower Coach.
               </p>
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
          >
            Sign up
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          {/* Update login link to include redirect */}
          <Link href={loginUrl} className="font-medium text-primary hover:underline">
            Log in here
          </Link>
        </p>
    </> // Close fragment
  );
}
