const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const https = require('https');
const { randomUUID } = require('crypto');

// --- AWS and Environment Configuration ---
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const oneSignalAppId = process.env.ONESIGNAL_APP_ID;
const oneSignalApiKey = process.env.ONESIGNAL_REST_API_KEY;

// --- Constants ---
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};
const severityMap = {
    'low': 'low',
    'medium': 'medium',
    'high': 'high',
    'critical': 'high',
    'info': 'low',
    'warning': 'medium',
    'error': 'high'
};

// --- Main Lambda Handler ---
exports.handler = async (event) => {
    // Handle CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return createResponse(null, 200);
    }

    if (event.httpMethod !== 'POST') {
        return createErrorResponse('Method not allowed', 405);
    }

    try {
        if (!oneSignalAppId || !oneSignalApiKey) {
            throw new Error('Missing OneSignal configuration in environment variables.');
        }

        const rawRequestData = JSON.parse(event.body);
        const { isValid, errors, data: processedData } = transformAndValidatePayload(rawRequestData);

        if (!isValid) {
            return createErrorResponse('Validation failed', 400, { validation_errors: errors });
        }

        const { type, title, message, site, priority, topic_id, topic_name, severity, timestamp } = processedData;

        let resolvedTopicId = topic_id?.trim() || null;
        if (topic_name && !resolvedTopicId) {
            const { Items: topicData } = await docClient.send(new QueryCommand({
                TableName: 'topics',
                IndexName: 'name-index', // Assumes a GSI on the 'name' attribute
                KeyConditionExpression: '#name = :name',
                ExpressionAttributeNames: { '#name': 'name' },
                ExpressionAttributeValues: { ':name': topic_name.trim() }
            }));

            if (!topicData || topicData.length === 0) {
                 return createErrorResponse(`Invalid topic name: "${topic_name}"`, 400);
            }
            resolvedTopicId = topicData[0].id;
        }

        const newNotification = {
            id: randomUUID(), // Generate a UUID for the primary key
            type: type || 'custom',
            title: title.trim(),
            message: message.trim(),
            severity: severityMap[String(severity || priority).toLowerCase()] || 'medium',
            status: 'new',
            timestamp: timestamp || new Date().toISOString(),
            site: site?.trim() || null,
            topic_id: resolvedTopicId
        };

        await docClient.send(new PutCommand({
            TableName: 'notifications',
            Item: newNotification
        }));

        let pushNotificationResult = null;
        if (resolvedTopicId) {
            pushNotificationResult = await sendOneSignalNotification(resolvedTopicId, newNotification);
        }

        return createResponse({
            success: true,
            data: newNotification,
            push_notification: pushNotificationResult
        }, 201);

    } catch (error) {
        console.error('Internal server error:', error);
        return createErrorResponse('Internal server error', 500, { error_message: error.message });
    }
};

// --- Helper & Validation Functions ---

function createResponse(data, statusCode = 200) {
    return {
        statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    };
}

function createErrorResponse(error, status = 400, details) {
    return createResponse({ error, details, timestamp: new Date().toISOString() }, status);
}

function transformAndValidatePayload(data) {
    let transformedData = { ...data };
    const errors = [];
    if (!transformedData.message) {
        if (transformedData.body && typeof transformedData.body === 'string') {
            transformedData.message = transformedData.body;
        } else if (transformedData.content && typeof transformedData.content === 'string') {
            transformedData.message = transformedData.content;
        }
    }
    if (!transformedData.title || typeof transformedData.title !== 'string' || !transformedData.title.trim()) {
        errors.push('Title is required');
    }
    if (!transformedData.message || typeof transformedData.message !== 'string' || !transformedData.message.trim()) {
        errors.push('Message is required');
    }
    return { isValid: errors.length === 0, errors, data: transformedData };
}


// --- OneSignal Sending Logic ---

async function sendOneSignalNotification(topicId, notificationData) {
    console.log(`[DEBUG] Starting push process for topic ID: ${topicId}`);

    const { Items: subscriptions } = await docClient.send(new QueryCommand({
        TableName: 'topic_subscriptions',
        IndexName: 'topic_id-index', // Assumes a GSI on topic_id
        KeyConditionExpression: 'topic_id = :topicId',
        ExpressionAttributeValues: { ':topicId': topicId }
    }));

    if (!subscriptions || subscriptions.length === 0) {
        console.log('No users subscribed to topic, skipping push.');
        return { status: 'skipped', reason: 'no_subscribers' };
    }
    const userIds = subscriptions.map((s) => s.user_id);
    console.log(`[DEBUG] Found User IDs for topic:`, userIds);

    // Fetch player IDs for each user in parallel
    const playerPromises = userIds.map(userId => docClient.send(new QueryCommand({
        TableName: 'onesignal_players',
        IndexName: 'user_id-index', // Assumes a GSI on user_id
        KeyConditionExpression: 'user_id = :userId',
        ExpressionAttributeValues: { ':userId': userId }
    })));
    const playerResults = await Promise.all(playerPromises);
    const playerIds = playerResults.flatMap(result => result.Items.map(item => item.player_id));

    if (playerIds.length === 0) {
        console.log('No push-enabled users for this topic, skipping push.');
        return { status: 'skipped', reason: 'no_push_enabled_users' };
    }
    console.log(`[DEBUG] Final list of Player IDs to target:`, playerIds);
    
    const oneSignalPayload = {
        app_id: oneSignalAppId,
        include_player_ids: playerIds,
        headings: { en: notificationData.title },
        contents: { en: notificationData.message },
        subtitle: { en: `Site: ${notificationData.site || 'General'} | Severity: ${notificationData.severity}`},
        data: { ...notificationData },
        priority: notificationData.severity === 'high' ? 10 : 5
    };

    console.log('Sending final payload to OneSignal:', oneSignalPayload);

    return new Promise((resolve, reject) => {
        const req = https.request('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${oneSignalApiKey}`
            }
        }, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                const responseBody = JSON.parse(body);
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({
                        status: 'sent',
                        onesignal_id: responseBody.id,
                        recipients: responseBody.recipients || 0
                    });
                } else {
                    reject(new Error(`OneSignal API error: ${JSON.stringify(responseBody)}`));
                }
            });
        });

        req.on('error', (e) => reject(new Error(`OneSignal request failed: ${e.message}`)));
        req.write(JSON.stringify(oneSignalPayload));
        req.end();
    });
}
