import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async headers() {
    return [
      {
        // Apply these headers to all routes in your application.
        source: '/:path*',
        headers: [
          // Allow requests from your ngrok domain
          {
            key: 'Access-Control-Allow-Origin',
            // Use the specific ngrok URL from your .env file
            value: process.env.NEXT_PUBLIC_SITE_URL || '*', // Fallback to wildcard, though specific is better
          },
          // Add other CORS headers if needed, e.g., for methods or headers
          // { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          // { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ];
  },
};

export default nextConfig;
