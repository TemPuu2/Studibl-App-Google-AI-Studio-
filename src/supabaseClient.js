import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client configuration module.
 * This client provides persistent communication with your Supabase backend services,
 * enabling capabilities like authentication, database querying, and file storage.
 */

// Replace the placeholder values below with your actual Supabase URL and public API key.
// These credentials can be found in your Supabase project dashboard under Project Settings > API.
const SUPABASE_URL = "https://uedhjlnwkayukcersgvu.supabase.co";
const SUPABASE_PUBLIC_KEY = "sb_publishable_x36Ql0OHZZnd15Q26AEWMg_Q7pNz7MW";

// Resilient fetch wrapper to catch network/DNS failures and handle offline gracefully
const resilientFetch = async (input, init) => {
  try {
    return await fetch(input, init);
  } catch (error) {
    console.warn("[Supabase Resilient Fetch] Caught network/fetch failure:", error?.message || error);
    
    const url = typeof input === "string" ? input : (input?.url || "");

    // For PostgREST database table operations, return a safe empty list response so
    // application contexts fallback gracefully to local storage without throwing errors.
    if (url.includes("/rest/v1/")) {
      return new Response(JSON.stringify([]), {
        status: 200,
        statusText: "OK",
        headers: {
          "Content-Type": "application/json",
          "Content-Range": "0-0/0"
        }
      });
    }

    // For Auth endpoints, return empty auth state without throwing
    if (url.includes("/auth/v1/")) {
      return new Response(JSON.stringify({ user: null, session: null }), {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "application/json" }
      });
    }

    // For storage or any other endpoints, return safe default response
    return new Response(JSON.stringify({ data: [], error: null }), {
      status: 200,
      statusText: "OK",
      headers: { "Content-Type": "application/json" }
    });
  }
};

/**
 * Root Supabase Client connection instance.
 * Import this instance throughout your application to access the Supabase services.
 * 
 * @type {import('@supabase/supabase-js').SupabaseClient}
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
  global: {
    fetch: resilientFetch
  }
});
