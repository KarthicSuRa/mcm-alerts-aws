import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};

console.log("Create-notification function starting...");

const oneSignalAppId = Deno.env.get('VITE_ONESIGNAL_APP_ID');
const oneSignalApiKey = Deno.env.get('ONESIGNAL_REST_API_KEY');

if (oneSignalAppId && oneSignalApiKey) {
  console.log("OneSignal configured successfully");
} else {
  console.warn("OneSignal keys not found - push notifications disabled");
}

Deno.serve(async (req) => {
  console.log(`${req.method} request received`);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const requestData = await req.json();
    console.log('Request data:', requestData);

    const { type, title, message, site, priority, topic_id, severity } = requestData;

    if (!title || !message) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: title and message'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }

    const severityMap = {
      'low': 'low',
      'medium': 'medium',
      'high': 'high',
      'critical': 'high'
    };

    const finalSeverity = severity || (priority ? severityMap[priority.toLowerCase()] : null) || 'medium';

    const newNotification = {
      type: type || 'custom',
      title,
      message,
      severity: finalSeverity,
      status: 'new',
      timestamp: new Date().toISOString(),
      site: site || null,
      topic_id: topic_id || null
    };

    console.log('Inserting notification:', newNotification);

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert([newNotification])
      .select()
      .single();

    if (error) {
      console.error('Database insert error:', error);
      throw error;
    }

    console.log('Notification inserted successfully:', data.id);

    // Send OneSignal Push Notifications
    if (topic_id && oneSignalAppId && oneSignalApiKey) {
      console.log(`Processing OneSignal push notifications for topic: ${topic_id}`);
      
      try {
        // Get users subscribed to this topic
        const { data: subscriptions, error: subError } = await supabaseAdmin
          .from('topic_subscriptions')
          .select('user_id')
          .eq('topic_id', topic_id);

        if (subError) {
          console.error('Error fetching subscriptions:', subError);
        } else if (subscriptions && subscriptions.length > 0) {
          const userIds = subscriptions.map(s => s.user_id);
          console.log(`Found ${userIds.length} subscribed users`);

          // Get OneSignal player IDs for these users
          const { data: oneSignalPlayers, error: playersError } = await supabaseAdmin
            .from('onesignal_players')
            .select('player_id, user_id')
            .in('user_id', userIds);

          if (playersError) {
            console.error('Error fetching OneSignal players:', playersError);
          } else if (oneSignalPlayers && oneSignalPlayers.length > 0) {
            console.log(`Found ${oneSignalPlayers.length} OneSignal player IDs`);

            const playerIds = oneSignalPlayers.map(p => p.player_id);

            // Prepare OneSignal notification payload
            const oneSignalPayload = {
              app_id: oneSignalAppId,
              include_player_ids: playerIds,
              headings: { en: data.title },
              contents: { en: data.message },
              data: {
                notification_id: data.id,
                severity: data.severity,
                topic_id: data.topic_id,
                timestamp: data.timestamp
              },
              // Set priority based on severity
              priority: data.severity === 'high' ? 10 : 5,
              // Add custom sound and icon
              android_sound: 'alert',
              ios_sound: 'alert.wav',
              small_icon: 'ic_notification',
              large_icon: '/icons/icon-192x192.png',
              // Add action buttons
              buttons: [
                {
                  id: 'view',
                  text: 'View Alert'
                },
                {
                  id: 'dismiss',
                  text: 'Dismiss'
                }
              ],
              // Set badge and other options
              ios_badgeType: 'Increase',
              ios_badgeCount: 1,
              // Filter by tags to ensure only subscribed users get notifications
              filters: [
                {
                  field: 'tag',
                  key: `topic_${topic_id}`,
                  relation: '=',
                  value: 'true'
                }
              ]
            };

            console.log('OneSignal payload:', JSON.stringify(oneSignalPayload, null, 2));

            // Send notification via OneSignal REST API
            const oneSignalResponse = await fetch('https://onesignal.com/api/v1/notifications', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${oneSignalApiKey}`
              },
              body: JSON.stringify(oneSignalPayload)
            });

            const oneSignalResult = await oneSignalResponse.json();
            
            if (oneSignalResponse.ok) {
              console.log('OneSignal notification sent successfully:', oneSignalResult);
              console.log(`Recipients: ${oneSignalResult.recipients || 0}`);
            } else {
              console.error('OneSignal API error:', oneSignalResult);
            }
          } else {
            console.log('No OneSignal player IDs found for subscribed users');
          }
        } else {
          console.log('No users subscribed to topic');
        }
      } catch (oneSignalError) {
        console.error('OneSignal notification process error:', oneSignalError);
        // Don't fail the whole request if push notifications fail
      }
    } else {
      console.log('Skipping OneSignal notifications - missing topic_id or OneSignal keys');
    }

    return new Response(JSON.stringify({
      success: true,
      data,
      message: 'Notification created successfully'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      details: error.toString()
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
