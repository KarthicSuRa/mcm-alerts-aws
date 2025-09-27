import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { topic_id } = await req.json()
    if (!topic_id) {
      return new Response(JSON.stringify({ error: 'topic_id is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin
      .from('topic_subscriptions')
      .select(`
        user:users (
          id,
          email,
          profile:profiles ( full_name, avatar_url )
        )
      `)
      .eq('topic_id', topic_id)

    if (subscriptionsError) throw subscriptionsError

    const subscribedUsers = subscriptions
      .map((s) => s.user)
      .filter(Boolean) 
      .map(user => {
        const profile = Array.isArray(user.profile) ? user.profile[0] : user.profile;

        return {
          id: user.id,
          email: user.email,
          full_name: profile?.full_name, 
          avatar_url: profile?.avatar_url
        }
      });

    return new Response(JSON.stringify(subscribedUsers), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
