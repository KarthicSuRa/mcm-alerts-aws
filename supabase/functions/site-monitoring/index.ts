import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FAKE_USER_AGENT = 'MCM Monitor Alerts';

async function triggerNotifications(supabase: SupabaseClient, results: any[], sites: any[]) {
  const downSiteResults = results.filter(result => !result.is_up);

  if (downSiteResults.length === 0) {
    return;
  }

  console.log(`Found ${downSiteResults.length} down sites. Triggering notifications...`);

  const notificationPromises = downSiteResults.map(result => {
    const site = sites.find(s => s.id === result.site_id);
    if (!site) {
      console.error(`Could not find site with ID ${result.site_id} for notification.`);
      return Promise.resolve(); // Continue with other notifications
    }

    const payload = {
      title: `Site Down Alert: ${site.name}`,
      message: `The monitored site "${site.name}" was detected as down. Error: ${result.error_message || 'No details available.'}`,
      severity: 'high',
      type: 'site_alert',
      site: site.name,
      topic_name: 'Site Monitoring' // Ensure this topic exists
    };

    console.log(`Invoking 'create-notification' for site: ${site.name}`);
    return supabase.functions.invoke('create-notification', {
      body: payload
    });
  });

  const notificationResults = await Promise.all(notificationPromises);

  notificationResults.forEach((res, index) => {
    // Check if the promise was resolved without an actual API call (e.g., site not found)
    if (!res) return;

    const site = sites.find(s => s.id === downSiteResults[index].site_id);
    if (res.error) {
      console.error(`Error invoking notification for ${site?.name}:`, res.error);
    } else {
      console.log(`Successfully invoked notification for ${site?.name}.`);
    }
  });
}

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
      .eq('status', 'active');

    if (sitesError) {
      console.error('Error fetching sites:', sitesError);
      throw sitesError;
    }

    console.log(`Found ${sites.length} active sites to monitor.`);

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
          method: 'GET',
          headers: { 'User-Agent': FAKE_USER_AGENT },
          redirect: 'follow'
        });

        response_time_ms = Date.now() - start;
        status_code = response.status;
        status_text = response.statusText;
        is_up = response.status >= 200 && response.status < 400;

        if (!is_up) {
            error_message = `Server responded with status: ${status_code} ${status_text}`;
            console.log(`✓ Result for "${site.name}": Status ${status_code} (${response_time_ms}ms) - DOWN`);
        } else {
            console.log(`✓ Result for "${site.name}": Status ${status_code} (${response_time_ms}ms)`);
        }

      } catch (e) {
        response_time_ms = Date.now() - start;
        error_message = e.message;
        is_up = false;
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

    // Fork off notifications and log insertion to run in parallel
    await Promise.all([
      triggerNotifications(supabase, results, sites),
      (async () => {
        if (results.length > 0) {
          const { error: insertError } = await supabase.from('ping_logs').insert(results);
          if (insertError) {
            console.error('Error bulk inserting logs:', insertError);
            // Non-fatal, don't throw, just log it. The main function can still succeed.
          } else {
            console.log(`✅ Successfully inserted ${results.length} logs into the database.`);
          }
        }
      })()
    ]);

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