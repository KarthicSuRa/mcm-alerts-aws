
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Immediately handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const results = [];
  const baseUrl = "https://nl.mcmworldwide.com/en_NL/home";

  // --- Lightweight HTTP Check (No Browser) ---
  try {
    const startTime = Date.now();
    // Use a simple fetch instead of a full browser
    const response = await fetch(baseUrl, { method: "GET" });
    const duration = Date.now() - startTime;

    if (!response.ok) {
      // The server responded with an error status (e.g., 404, 500)
      throw new Error(`Server responded with status: ${response.status}`);
    }

    // If we get here, the request was successful
    results.push({
      scenario: "Homepage HTTP Check",
      status: "Success",
      duration: duration,
    });

  } catch (error) {
    // This will catch network errors or the error thrown above
    results.push({
      scenario: "Homepage HTTP Check",
      status: "Failed",
      error: error.message,
    });
  }

  // Return the results
  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
