import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

serve(async (req) => {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: sites, error: sitesError } = await supabase
    .from('monitored_sites')
    .select('id, url')
    .eq('is_paused', false);

  if (sitesError) {
    console.error('Error fetching sites:', sitesError);
    return new Response(JSON.stringify({ error: sitesError.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  const checks = sites.map(async (site) => {
    const start = Date.now();
    let status_code = 0;
    let is_up = false;
    let response_time_ms = 0;
    let status_text = '';
    let error_message = null;

    try {
      const response = await fetch(site.url, { method: 'HEAD' });
      response_time_ms = Date.now() - start;
      status_code = response.status;
      status_text = response.statusText;
      is_up = response.ok;
    } catch (e) {
      response_time_ms = Date.now() - start;
      error_message = e.message;
    }

    return supabase.from('ping_logs').insert({
      site_id: site.id,
      is_up,
      response_time_ms,
      status_code,
      status_text,
      error_message,
    });
  });

  await Promise.all(checks);

  return new Response(JSON.stringify({ message: `Checks completed for ${sites.length} sites.` }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
