declare const Deno: any;

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'https://esm.sh/web-push@3.6.7'

// Note: This is a simplified CORS header. In a production environment,
// you would want to restrict this to your specific domains.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Create-notification function booting up!");

// VAPID keys should be set in Supabase Function's environment variables
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(
        'mailto:admin@example.com', // This should be a valid admin email address
        vapidPublicKey,
        vapidPrivateKey
    );
    console.log("VAPID details set.");
} else {
    console.warn("VAPID keys not found in environment. Push notifications will be disabled.");
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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
    
    const { data: newNotificationData, error: insertError } = await supabaseAdmin
      .from('notifications')
      .insert([newNotification])
      .select()
      .single();

    if (insertError) {
      console.error('Supabase insert error:', insertError);
      throw insertError;
    }

    console.log('Successfully inserted notification:', newNotificationData);
    
    // --- Send Push Notifications ---
    if (topic_id && vapidPublicKey && vapidPrivateKey) {
        // 1. Find users subscribed to the topic
        const { data: subscriptions, error: subError } = await supabaseAdmin
            .from('topic_subscriptions')
            .select('user_id')
            .eq('topic_id', topic_id);

        if (subError) {
            console.error('Error fetching topic subscriptions:', subError);
        } else if (subscriptions && subscriptions.length > 0) {
            const userIds = subscriptions.map(s => s.user_id);

            // 2. Get push subscriptions for these users
            const { data: pushSubscriptions, error: pushSubError } = await supabaseAdmin
                .from('push_subscriptions')
                .select('endpoint, keys')
                .in('user_id', userIds);

            if (pushSubError) {
                console.error('Error fetching push subscriptions:', pushSubError);
            } else if (pushSubscriptions) {
                const pushPayload = JSON.stringify({
                    title: newNotificationData.title,
                    message: newNotificationData.message,
                    url: `/`
                });

                // 3. Send notifications
                const sendPromises = pushSubscriptions.map(sub => {
                    const pushSubscription = {
                        endpoint: sub.endpoint,
                        keys: {
                            p256dh: sub.keys.p256dh,
                            auth: sub.keys.auth
                        }
                    };
                    return webpush.sendNotification(pushSubscription, pushPayload)
                        .catch((err: any) => {
                            console.error(`Error sending push notification to ${sub.endpoint.substring(0, 40)}...:`, err.statusCode);
                            // If endpoint is gone (410) or not found (404), delete it from our DB
                            if (err.statusCode === 410 || err.statusCode === 404) {
                                console.log('Deleting stale push subscription.');
                                return supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
                            }
                        });
                });

                await Promise.all(sendPromises);
                console.log(`Sent ${pushSubscriptions.length} push notifications.`);
            }
        }
    }

    return new Response(JSON.stringify({ data: newNotificationData }), {
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
