import type { NextConfig } from "next";

const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || process.env.SUPABASE_PUBLISHABLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || process.env.SUPABASE_ANON_KEY;

if (publicKey && !publicKey.startsWith("sb_publishable_")) {
  let role: unknown;
  try {
    role = JSON.parse(Buffer.from(publicKey.split(".")[1] ?? "", "base64url").toString()).role;
  } catch {
    // Invalid keys must never reach the browser bundle.
  }
  if (role !== "anon") {
    throw new Error("Only a Supabase publishable or anon key may be exposed to the browser.");
  }
}

const nextConfig: NextConfig = {
  // Map only public connection settings from the Vercel Supabase integration.
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey,
  },
};

export default nextConfig;
