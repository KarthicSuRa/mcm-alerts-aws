declare const Deno: any;

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'https://esm.sh/web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Create-notification function booting up!");

const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(
        'mailto:admin@mcmalerts.com', // Update this to your admin email
        vapidPublicKey,
        vapidPrivateKey
    );
    console.log("VAPID details set.");
} else {
    console.warn("VAPID keys not found in environment. Push notifications will be disabled.");
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const requestData = await req.json();
    console.log('Received request data:', requestData);
    
    // Handle both your frontend format and external API format
    const {
      type = 'server_alert',
      title,
      message,
      severity,
      site,
      topic_id,
      // Alternative field names for external APIs
      priority,
      status = 'new',
      timestamp = new Date().toISOString()
    } = requestData;
    
    // Basic validation
    if (!title || !message) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: title and message are required' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    
    // Map severity/priority to your database format
    const severityMap: {[key: string]: 'low' | 'medium' | 'high'} = {
      'low': 'low',
      'medium': 'medium',
      'high': 'high',
      'critical': 'high' // Map critical to high since your DB doesn't have critical
    };

    const finalSeverity = severity || 
                         (priority ? severityMap[priority.toLowerCase()] : null) || 
                         'medium';

    const newNotification = {
        type,
        title,
        message,
        severity: finalSeverity,
        status,
        timestamp,
        site: site || null,
        topic_id: topic_id || null,
    };
    
    console.log('Inserting notification:', newNotification);
    
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
    
    // Send Push Notifications
    if (topic_id && vapidPublicKey && vapidPrivateKey) {
        const { data: subscriptions, error: subError } = await supabaseAdmin
            .from('topic_subscriptions')
            .select('user_id')
            .eq('topic_id', topic_id);

        if (subError) {
            console.error('Error fetching topic subscriptions:', subError);
        } else if (subscriptions && subscriptions.length > 0) {
            const userIds = subscriptions.map(s => s.user_id);

            const { data: pushSubscriptions, error: pushSubError } = await supabaseAdmin
                .from('push_subscriptions')
                .select('endpoint, keys')
                .in('user_id', userIds);

            if (pushSubError) {
                console.error('Error fetching push subscriptions:', pushSubError);
            } else if (pushSubscriptions && pushSubscriptions.length > 0) {
                const pushPayload = JSON.stringify({
                    title: newNotificationData.title,
                    message: newNotificationData.message,
                    severity: newNotificationData.severity,
                    id: newNotificationData.id,
                    timestamp: newNotificationData.timestamp,
                    url: `/`
                });

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
                            console.error(`Error sending push notification:`, err.statusCode);
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

    return new Response(JSON.stringify({ 
      success: true, 
      data: newNotificationData 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Function error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
