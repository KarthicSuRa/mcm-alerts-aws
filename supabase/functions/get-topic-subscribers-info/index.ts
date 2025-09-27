import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { topic_id } = await req.json();
    if (!topic_id) {
      return new Response(JSON.stringify({ error: '`topic_id` is required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Step 1: Fetch user_ids from the topic_subscriptions table.
    let userIds;
    try {
      const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin
        .from('topic_subscriptions')
        .select('user_id')
        .eq('topic_id', topic_id);

      if (subscriptionsError) {
        throw subscriptionsError;
      }
      userIds = subscriptions.map((sub) => sub.user_id);
    } catch (error) {
      throw new Error(`Failed to fetch from 'topic_subscriptions': ${error.message}`);
    }

    if (!userIds || userIds.length === 0) {
      // No subscribers for this topic, return an empty array.
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Step 2: Fetch the full profiles for the collected user_ids.
    let profiles;
    try {
      const { data, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      if (profilesError) {
        throw profilesError;
      }
      profiles = data;
    } catch (error) {
      throw new Error(`Failed to fetch from 'profiles': ${error.message}`);
    }
    
    // Return the list of profiles.
    return new Response(JSON.stringify(profiles), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    // Return a detailed error response.
    return new Response(JSON.stringify({ 
        error: 'Edge Function execution failed.',
        message: error.message,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
