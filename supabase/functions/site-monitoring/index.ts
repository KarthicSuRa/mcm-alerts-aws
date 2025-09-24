import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Standard browser User-Agent to avoid 403 Forbidden errors from WAFs
const FAKE_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: sites, error: sitesError } = await supabase
      .from('monitored_sites')
      .select('id, url, name')
      .eq('is_paused', false);

    if (sitesError) {
      console.error('Error fetching sites:', sitesError);
      throw sitesError;
    }

    console.log(`Found ${sites.length} sites to monitor.`);

    const checkPromises = sites.map(async (site) => {
      const start = Date.now();
      let status_code = 0;
      let is_up = false;
      let response_time_ms = 0;
      let status_text = '';
      let error_message: string | null = null;

      try {
        console.log(`Checking "${site.name}"...`);
        const response = await fetch(site.url, {
          method: 'GET', // Use GET instead of HEAD to better mimic a real user
          headers: { 'User-Agent': FAKE_USER_AGENT },
          redirect: 'follow' // Follow redirects to get the final status
        });

        response_time_ms = Date.now() - start;
        status_code = response.status;
        status_text = response.statusText;
        
        // Consider any 2xx or 3xx status as "up", as redirects are a valid sign of a working site.
        is_up = response.status >= 200 && response.status < 400;

        if (!is_up) {
            error_message = `Server responded with status: ${status_code} ${status_text}`;
            console.log(`✓ Result for "${site.name}": Status ${status_code} (${response_time_ms}ms) - DOWN`);
        } else {
            console.log(`✓ Result for "${site.name}": Status ${status_code} (${response_time_ms}ms)`);
        }
        
      } catch (e) {
        response_time_ms = Date.now() - start;
        // This catches network errors like DNS failures or connection refused.
        error_message = e.message;
        is_up = false; // Ensure is_up is marked as false
        console.error(`✗ Failure for "${site.name}": ${e.message} (${response_time_ms}ms)`);
      }

      return {
        site_id: site.id,
        is_up,
        response_time_ms,
        status_code,
        status_text,
        error_message,
      };
    });

    const results = await Promise.all(checkPromises);

    console.log(`Attempting to bulk insert ${results.length} logs...`);
    const { error: insertError } = await supabase.from('ping_logs').insert(results);

    if (insertError) {
      console.error('Error bulk inserting logs:', insertError);
      throw insertError;
    }
    
    console.log('✅ Successfully inserted all logs into the database.');

    return new Response(
      JSON.stringify({ message: `Successfully checked ${sites.length} sites.` }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('An unexpected error occurred in the site monitoring function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
