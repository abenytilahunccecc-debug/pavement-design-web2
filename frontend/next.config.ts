import type { NextConfig } from "next";

// On Vercel (VERCEL=1) the API address must be set, or the live site would call http://localhost:4000.
if (process.env.VERCEL && !process.env.NEXT_PUBLIC_API_URL) {
  throw new Error(
    "NEXT_PUBLIC_API_URL is not set. Vercel -> Project -> Settings -> Environment Variables: " +
    "add your Render API address (e.g. https://<service>.onrender.com), then redeploy.",
  );
}

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
