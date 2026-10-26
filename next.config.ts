import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["cerebrally-revengeless-dell.ngrok-free.dev"],
  logging: {
    fetches: { fullUrl: true },
    serverFunctions: false,
    incomingRequests: {
      // Dodo appends the customer's email to the checkout return URL.
      ignore: [/\/api\/auth\/callback/, /\/api\/slack\/oauth_redirect/, /\/api\/billing\/return/],
    },
  },
};

export default nextConfig;
