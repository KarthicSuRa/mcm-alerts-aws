
declare const Deno: any;

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Note: This is a simplified CORS header. In a production environment,
// you would want to restrict this to your specific domains.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Create-notification function booting up!");

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // NOTE: We are creating an admin client here to bypass RLS,
    // because this function is designed to be called by external,
    // unauthenticated services.
    // In your Supabase project settings, you MUST set the
    // `SUPABASE_SERVICE_ROLE_KEY` environment variable.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { type, title, message, site, priority, topic_id } = await req.json();
    
    // Basic validation
    if (!title || !message || !priority) {
      return new Response(JSON.stringify({ error: 'Missing required fields: title, message, priority' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    
    const severityMap: {[key: string]: 'low' | 'medium' | 'high'} = {
      'low': 'low',
      'medium': 'medium',
      'high': 'high'
    };

    const newNotification = {
        type: type || 'custom',
        title,
        message,
        severity: severityMap[priority.toLowerCase()] || 'low',
        status: 'new',
        timestamp: new Date().toISOString(),
        site: site || null,
        topic_id: topic_id || null,
    };
    
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert([newNotification])
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }

    console.log('Successfully inserted notification:', data);

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Function error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500, // Using 500 for server-side errors
    });
  }
});
