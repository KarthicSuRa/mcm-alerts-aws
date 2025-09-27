// supabase/functions/create-notification/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// --- Configuration & Constants ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};
console.log("Create-notification function starting...");
const oneSignalAppId = Deno.env.get('ONESIGNAL_APP_ID');
const oneSignalApiKey = Deno.env.get('ONESIGNAL_REST_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const severityMap = {
  'low': 'low',
  'medium': 'medium',
  'high': 'high',
  'critical': 'high',
  'info': 'low',
  'warning': 'medium',
  'error': 'high'
};
// --- Helper & Validation Functions ---
function createErrorResponse(error, status = 400, details) {
  return new Response(JSON.stringify({
    error,
    details,
    timestamp: new Date().toISOString()
  }), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    },
    status
  });
}
/**
 * NEW & IMPROVED: This function now transforms the payload before validating it.
 * It ensures the payload has a `message` field by mapping it from `body` or `content` if necessary.
 * @param data The raw incoming request data.
 * @returns An object containing validation status, errors, and the transformed data.
 */ function transformAndValidatePayload(data) {
  let transformedData = {
    ...data
  };
  const errors = [];
  // ** THE FIX: ADAPTER LOGIC **
  // If `message` is missing, try to map it from `body` or other common fields.
  if (!transformedData.message) {
    if (transformedData.body && typeof transformedData.body === 'string') {
      console.log("Transforming payload: Mapping 'body' to 'message'.");
      transformedData.message = transformedData.body;
    } else if (transformedData.content && typeof transformedData.content === 'string') {
      console.log("Transforming payload: Mapping 'content' to 'message'.");
      transformedData.message = transformedData.content;
    }
  }
  // ** EXISTING VALIDATION LOGIC **
  // Now, proceed with validation on the (potentially transformed) data.
  if (!transformedData.title || typeof transformedData.title !== 'string' || !transformedData.title.trim()) {
    errors.push('Title is required and must be a non-empty string');
  }
  if (!transformedData.message || typeof transformedData.message !== 'string' || !transformedData.message.trim()) {
    errors.push('Message is required and must be a non-empty string');
  }
  if (transformedData.title && transformedData.title.length > 255) {
    errors.push('Title too long (max 255 characters)');
  }
  if (transformedData.message && transformedData.message.length > 2000) {
    errors.push('Message too long (max 2000 characters)');
  }
  // ... add any other pre-existing validation rules here ...
  return {
    isValid: errors.length === 0,
    errors,
    data: transformedData
  };
}
// --- Main Server Function ---
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }
  if (req.method !== 'POST') {
    return createErrorResponse('Method not allowed', 405);
  }
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required Supabase configuration');
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    let rawRequestData;
    try {
      rawRequestData = await req.json();
    } catch (e) {
      return createErrorResponse('Invalid JSON in request body');
    }
    console.log('Received raw request data:', rawRequestData);
    // Use the new transformer and validator function
    const { isValid, errors, data: processedData } = transformAndValidatePayload(rawRequestData);
    if (!isValid) {
      return createErrorResponse('Validation failed', 400, {
        validation_errors: errors
      });
    }
    const { type, title, message, site, priority, topic_id, topic_name, severity, timestamp } = processedData;
    // --- Topic Resolution ---
    let resolvedTopicId = topic_id?.trim() || null;
    let resolvedTopicName = topic_name?.trim() || null;
    if (resolvedTopicName && !resolvedTopicId) {
      const { data: topicData, error: topicError } = await supabaseAdmin.from('topics').select('id, name').eq('name', resolvedTopicName).single();
      if (topicError) {
        return createErrorResponse(`Invalid topic name: "${resolvedTopicName}"`, 400);
      }
      resolvedTopicId = topicData.id;
    }
    // ... rest of your topic resolution logic ...
    // --- Notification Creation ---
    const finalSeverity = severityMap[String(severity || priority).toLowerCase()] || 'medium';
    const finalType = type || 'custom';
    const newNotification = {
      type: finalType,
      title: title.trim(),
      message: message.trim(),
      severity: finalSeverity,
      status: 'new',
      timestamp: timestamp || new Date().toISOString(),
      site: site?.trim() || null,
      topic_id: resolvedTopicId
    };
    console.log('Inserting notification:', newNotification);
    const { data: insertedNotification, error: insertError } = await supabaseAdmin.from('notifications').insert(newNotification).select().single();
    if (insertError) {
      throw new Error(`Database error: ${insertError.message}`);
    }
    console.log('Notification inserted successfully:', insertedNotification.id);
    // --- OneSignal Push Notification Trigger ---
    let pushNotificationResult = null;
    if (resolvedTopicId && oneSignalAppId && oneSignalApiKey) {
      try {
        pushNotificationResult = await sendOneSignalNotification(supabaseAdmin, resolvedTopicId, insertedNotification, oneSignalAppId, oneSignalApiKey);
      } catch (oneSignalError) {
        console.error('OneSignal notification process error:', oneSignalError);
        pushNotificationResult = {
          status: 'error',
          error: oneSignalError.message
        };
      }
    } else {
      console.log('Skipping OneSignal notifications due to missing topic or configuration.');
    }
    return new Response(JSON.stringify({
      success: true,
      data: insertedNotification,
      message: 'Notification created successfully',
      push_notification: pushNotificationResult
    }), {
      status: 201,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Critical function error:', error);
    return createErrorResponse('Internal server error', 500, {
      error_message: error.message
    });
  }
});
// --- OneSignal Sending Logic ---
async function sendOneSignalNotification(supabaseAdmin, topicId, notificationData, appId, apiKey) {
  const { data: subscriptions, error: subError } = await supabaseAdmin.from('topic_subscriptions').select('user_id').eq('topic_id', topicId);
  if (subError) throw new Error(`Failed to fetch subscriptions: ${subError.message}`);
  if (!subscriptions || subscriptions.length === 0) {
    console.log('No users subscribed to topic, skipping push.');
    return {
      status: 'skipped',
      reason: 'no_subscribers'
    };
  }
  const userIds = subscriptions.map((s)=>s.user_id);
  const { data: oneSignalPlayers, error: playersError } = await supabaseAdmin.from('onesignal_players').select('player_id').in('user_id', userIds);
  if (playersError) throw new Error(`Failed to fetch OneSignal players: ${playersError.message}`);
  if (!oneSignalPlayers || oneSignalPlayers.length === 0) {
    console.log('No push-enabled users for this topic, skipping push.');
    return {
      status: 'skipped',
      reason: 'no_push_enabled_users'
    };
  }
  const playerIds = oneSignalPlayers.map((p)=>p.player_id);
  const oneSignalPayload = {
    app_id: appId,
    include_player_ids: playerIds,
    headings: {
      en: notificationData.title
    },
    contents: {
      en: notificationData.message
    },
    data: {
      notification_id: notificationData.id,
      topic_id: notificationData.topic_id
    },
    priority: notificationData.severity === 'high' ? 10 : 5
  };
  const oneSignalResponse = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${apiKey}`
    },
    body: JSON.stringify(oneSignalPayload)
  });
  if (!oneSignalResponse.ok) {
    const errorBody = await oneSignalResponse.json();
    throw new Error(`OneSignal API error: ${JSON.stringify(errorBody)}`);
  }
  const oneSignalResult = await oneSignalResponse.json();
  console.log('OneSignal notification sent successfully:', oneSignalResult.id);
  return {
    status: 'sent',
    onesignal_id: oneSignalResult.id,
    recipients: oneSignalResult.recipients || 0
  };
}
