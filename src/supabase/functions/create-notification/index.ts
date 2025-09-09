import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};
console.log("Create-notification function starting...");
// Environment variables
const oneSignalAppId = Deno.env.get('ONESIGNAL_APP_ID');
const oneSignalApiKey = Deno.env.get('ONESIGNAL_REST_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
console.log("Environment check:");
console.log("SUPABASE_URL present:", !!supabaseUrl);
console.log("SUPABASE_SERVICE_ROLE_KEY present:", !!supabaseServiceKey);
console.log("ONESIGNAL_APP_ID present:", !!oneSignalAppId);
console.log("ONESIGNAL_REST_API_KEY present:", !!oneSignalApiKey);
if (oneSignalAppId && oneSignalApiKey) {
  console.log("OneSignal configured successfully");
} else {
  console.warn("OneSignal keys not found - push notifications disabled");
  if (!oneSignalAppId) console.warn("Missing ONESIGNAL_APP_ID");
  if (!oneSignalApiKey) console.warn("Missing ONESIGNAL_REST_API_KEY");
}
// Constants
const VALID_SEVERITIES = [
  'low',
  'medium',
  'high'
];
const VALID_TYPES = [
  'server_alert',
  'application_error',
  'security_event',
  'maintenance',
  'custom'
];
const VALID_STATUSES = [
  'new',
  'acknowledged',
  'resolved'
];
// Severity mapping with validation
const severityMap = {
  'low': 'low',
  'medium': 'medium',
  'high': 'high',
  'critical': 'high',
  'info': 'low',
  'warning': 'medium',
  'error': 'high'
};
function validateAndNormalizeSeverity(severity, priority) {
  // Try severity first
  if (severity) {
    const normalizedSeverity = severity.toLowerCase();
    if (severityMap[normalizedSeverity]) {
      return severityMap[normalizedSeverity];
    }
  }
  // Try priority as fallback
  if (priority) {
    const normalizedPriority = priority.toLowerCase();
    if (severityMap[normalizedPriority]) {
      return severityMap[normalizedPriority];
    }
  }
  // Default to medium
  console.warn(`Invalid severity/priority provided: ${severity}/${priority}, defaulting to 'medium'`);
  return 'medium';
}
function validateNotificationType(type) {
  if (type && VALID_TYPES.includes(type)) {
    return type;
  }
  return 'custom';
}
function validateInput(data) {
  const errors = [];
  // Required fields
  if (!data.title || typeof data.title !== 'string' || !data.title.trim()) {
    errors.push('Title is required and must be a non-empty string');
  }
  if (!data.message || typeof data.message !== 'string' || !data.message.trim()) {
    errors.push('Message is required and must be a non-empty string');
  }
  // Field length validation
  if (data.title && data.title.length > 255) {
    errors.push('Title too long (max 255 characters)');
  }
  if (data.message && data.message.length > 2000) {
    errors.push('Message too long (max 2000 characters)');
  }
  if (data.site && data.site.length > 100) {
    errors.push('Site too long (max 100 characters)');
  }
  // Optional field type validation
  if (data.topic_id && (typeof data.topic_id !== 'string' || !data.topic_id.trim())) {
    errors.push('topic_id must be a non-empty string if provided');
  }
  if (data.topic_name && (typeof data.topic_name !== 'string' || !data.topic_name.trim())) {
    errors.push('topic_name must be a non-empty string if provided');
  }
  // Timestamp validation
  if (data.timestamp) {
    const timestamp = new Date(data.timestamp);
    if (isNaN(timestamp.getTime())) {
      errors.push('timestamp must be a valid ISO date string if provided');
    }
  }
  return {
    isValid: errors.length === 0,
    errors
  };
}
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
Deno.serve(async (req)=>{
  console.log(`${req.method} request received`);
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
    // Validate environment
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required Supabase configuration');
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    let requestData;
    try {
      requestData = await req.json();
    } catch (e) {
      return createErrorResponse('Invalid JSON in request body');
    }
    console.log('Request data:', requestData);
    // Validate input
    const validation = validateInput(requestData);
    if (!validation.isValid) {
      return createErrorResponse('Validation failed', 400, {
        validation_errors: validation.errors
      });
    }
    const { type, title, message, site, priority, topic_id, topic_name, severity, timestamp } = requestData;
    // Handle topic resolution
    let resolvedTopicId = topic_id?.trim() || null;
    let resolvedTopicName = topic_name?.trim() || null;
    // If topic_name is provided but topic_id is not, resolve the topic_name to topic_id
    if (resolvedTopicName && !resolvedTopicId) {
      console.log(`Resolving topic name: "${resolvedTopicName}"`);
      const { data: topicData, error: topicError } = await supabaseAdmin.from('topics').select('id, name').eq('name', resolvedTopicName).single();
      if (topicError) {
        console.error('Topic resolution error:', topicError);
        // Get available topics for better error message
        const { data: availableTopics } = await supabaseAdmin.from('topics').select('name').order('name');
        const availableTopicNames = availableTopics?.map((t)=>t.name).join(', ') || 'none';
        return createErrorResponse(`Invalid topic name: "${resolvedTopicName}"`, 400, {
          available_topics: availableTopicNames,
          database_error: topicError.message
        });
      }
      if (topicData) {
        resolvedTopicId = topicData.id;
        resolvedTopicName = topicData.name;
        console.log(`Topic "${resolvedTopicName}" resolved to ID: ${resolvedTopicId}`);
      }
    }
    // If topic_id is provided, get the topic name for logging
    if (resolvedTopicId && !resolvedTopicName) {
      const { data: topicData } = await supabaseAdmin.from('topics').select('name').eq('id', resolvedTopicId).single();
      if (topicData) {
        resolvedTopicName = topicData.name;
      } else {
        return createErrorResponse(`Invalid topic_id: "${resolvedTopicId}"`);
      }
    }
    // If both topic_name and topic_id are provided, prioritize topic_id but log a warning
    if (topic_name && topic_id) {
      console.warn(`Both topic_name ("${topic_name}") and topic_id ("${topic_id}") provided. Using topic_id.`);
    }
    // Validate and normalize severity
    const finalSeverity = validateAndNormalizeSeverity(severity, priority);
    const finalType = validateNotificationType(type);
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
    console.log('Inserting notification:', {
      ...newNotification,
      topic_name: resolvedTopicName
    });
    const { data, error } = await supabaseAdmin.from('notifications').insert([
      newNotification
    ]).select().single();
    if (error) {
      console.error('Database insert error:', error);
      throw new Error(`Database error: ${error.message}`);
    }
    console.log('Notification inserted successfully:', data.id);
    // Send OneSignal Push Notifications
    let pushNotificationResult = null;
    if (resolvedTopicId && oneSignalAppId && oneSignalApiKey) {
      console.log(`Processing OneSignal push notifications for topic: ${resolvedTopicId} (${resolvedTopicName})`);
      try {
        pushNotificationResult = await sendOneSignalNotification(supabaseAdmin, resolvedTopicId, data, oneSignalAppId, oneSignalApiKey);
      } catch (oneSignalError) {
        console.error('OneSignal notification process error:', oneSignalError);
        // Don't fail the whole request if push notifications fail
        pushNotificationResult = {
          status: 'error',
          error: oneSignalError.message
        };
      }
    } else {
      console.log('Skipping OneSignal notifications:');
      console.log('- resolvedTopicId provided:', !!resolvedTopicId);
      console.log('- oneSignalAppId available:', !!oneSignalAppId);
      console.log('- oneSignalApiKey available:', !!oneSignalApiKey);
    }
    return new Response(JSON.stringify({
      success: true,
      data,
      message: 'Notification created successfully',
      push_notification: pushNotificationResult,
      topic_resolved: resolvedTopicName ? {
        name: resolvedTopicName,
        id: resolvedTopicId
      } : null
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 201
    });
  } catch (error) {
    console.error('Function error:', error);
    return createErrorResponse('Internal server error', 500, {
      error_message: error.message
    });
  }
});
async function sendOneSignalNotification(supabaseAdmin, topicId, notificationData, appId, apiKey) {
  // Get users subscribed to this topic
  const { data: subscriptions, error: subError } = await supabaseAdmin.from('topic_subscriptions').select('user_id').eq('topic_id', topicId);
  if (subError) {
    console.error('Error fetching subscriptions:', subError);
    throw new Error(`Failed to fetch subscriptions: ${subError.message}`);
  }
  if (!subscriptions || subscriptions.length === 0) {
    console.log('No users subscribed to topic:', topicId);
    return {
      status: 'skipped',
      reason: 'no_subscribers',
      subscribers: 0
    };
  }
  const userIds = subscriptions.map((s)=>s.user_id);
  console.log(`Found ${userIds.length} subscribed users`);
  // Get OneSignal player IDs for these users
  const { data: oneSignalPlayers, error: playersError } = await supabaseAdmin.from('onesignal_players').select('player_id, user_id').in('user_id', userIds);
  if (playersError) {
    console.error('Error fetching OneSignal players:', playersError);
    throw new Error(`Failed to fetch OneSignal players: ${playersError.message}`);
  }
  if (!oneSignalPlayers || oneSignalPlayers.length === 0) {
    console.log('No OneSignal player IDs found for subscribed users');
    return {
      status: 'skipped',
      reason: 'no_push_enabled_users',
      subscribers: userIds.length,
      push_enabled: 0
    };
  }
  console.log(`Found ${oneSignalPlayers.length} OneSignal player IDs`);
  const playerIds = oneSignalPlayers.map((p)=>p.player_id);
  // Prepare OneSignal notification payload
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
      severity: notificationData.severity,
      topic_id: notificationData.topic_id,
      timestamp: notificationData.timestamp
    },
    priority: notificationData.severity === 'high' ? 10 : notificationData.severity === 'medium' ? 5 : 1,
    android_sound: notificationData.severity === 'high' ? 'alert' : 'default',
    ios_sound: notificationData.severity === 'high' ? 'alert.wav' : 'default',
    small_icon: 'ic_notification',
    large_icon: 'https://mcm-alerts.netlify.app/icons/icon-192x192.png',
    ios_badgeType: 'Increase',
    ios_badgeCount: 1,
    buttons: notificationData.severity === 'high' ? [
      {
        id: 'view',
        text: 'View Alert'
      },
      {
        id: 'acknowledge',
        text: 'Acknowledge'
      }
    ] : [
      {
        id: 'view',
        text: 'View'
      }
    ],
    web_url: 'https://mcm-alerts.netlify.app/',
    delayed_option: 'immediate'
  };
  console.log('OneSignal payload prepared for', playerIds.length, 'devices');
  // Send notification via OneSignal REST API
  const oneSignalResponse = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${apiKey}`
    },
    body: JSON.stringify(oneSignalPayload)
  });
  const oneSignalResult = await oneSignalResponse.json();
  if (oneSignalResponse.ok) {
    console.log('OneSignal notification sent successfully!');
    console.log('OneSignal Response:', {
      id: oneSignalResult.id,
      recipients: oneSignalResult.recipients || 0,
      external_id: oneSignalResult.external_id
    });
    if (oneSignalResult.recipients === 0) {
      console.warn('Warning: 0 recipients received the notification. This might indicate:');
      console.warn('- Player IDs are invalid or expired');
      console.warn('- Users have notifications disabled');
      console.warn('- App is not installed on devices');
    }
    return {
      status: 'sent',
      onesignal_id: oneSignalResult.id,
      recipients: oneSignalResult.recipients || 0,
      subscribers: userIds.length,
      push_enabled: oneSignalPlayers.length
    };
  } else {
    console.error('OneSignal API error response:', oneSignalResult);
    console.error('OneSignal error details:', {
      status: oneSignalResponse.status,
      statusText: oneSignalResponse.statusText
    });
    throw new Error(`OneSignal API error: ${oneSignalResponse.status} - ${JSON.stringify(oneSignalResult)}`);
  }
}
