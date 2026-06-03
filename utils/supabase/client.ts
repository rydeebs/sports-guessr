import { createBrowserClient } from "@supabase/ssr";

const FALLBACK_SUPABASE_URL = "https://wxnpchfxwhrjbvmwuftp.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_QkG2Js0UDkzEvefMIeCGbg_DllT1Z00";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? FALLBACK_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  FALLBACK_SUPABASE_PUBLISHABLE_KEY;

export const createClient = () => {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase browser env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in Vercel, then redeploy.",
    );
  }

  return createBrowserClient(supabaseUrl, supabaseKey);
};
