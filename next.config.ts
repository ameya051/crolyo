import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["cerebrally-revengeless-dell.ngrok-free.dev"],
  logging: {
    fetches: { fullUrl: true },
    serverFunctions: false,
    incomingRequests: {
      ignore: [/\/api\/auth\/callback/, /\/api\/slack\/oauth_redirect/],
    },
    browserToTerminal: true,
  },
};

export default nextConfig;
