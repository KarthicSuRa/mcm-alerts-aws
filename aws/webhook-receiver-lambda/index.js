const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require('crypto');

// --- AWS and Environment Configuration ---
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const WEBHOOK_SOURCES_TABLE = process.env.WEBHOOK_SOURCES_TABLE;
const WEBHOOK_EVENTS_TABLE = process.env.WEBHOOK_EVENTS_TABLE;
const NOTIFICATIONS_TABLE = process.env.NOTIFICATIONS_TABLE;

// --- CORS Headers ---
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// --- Main Lambda Handler ---
exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return createResponse(null, 204); // Use 204 No Content for OPTIONS
    }

    try {
        // 1. Get and validate source_id from query parameters
        const sourceId = event.queryStringParameters?.source_id;
        if (!sourceId) {
            return createErrorResponse("Missing source_id parameter", 400);
        }

        const { Item: source } = await docClient.send(new GetCommand({
            TableName: WEBHOOK_SOURCES_TABLE,
            Key: { id: sourceId }
        }));

        if (!source) {
            return createErrorResponse("Invalid or unauthorized source_id", 404);
        }

        const payload = JSON.parse(event.body);

        // 2. Always store the raw webhook event
        await docClient.send(new PutCommand({
            TableName: WEBHOOK_EVENTS_TABLE,
            Item: {
                id: randomUUID(),
                source_id: sourceId,
                payload: payload,
                received_at: new Date().toISOString()
            }
        }));

        // 3. Process and create a notification ONLY for failure events
        if (source.topic_id) {
            let notification;
            const baseMetadata = { sourceType: source.source_type };

            if (source.source_type === 'adyen') {
                notification = transformAdyenPayload(payload);
            } else {
                notification = transformGenericPayload(payload);
            }

            // Only insert if the transformer returns a notification (i.e., it's a failure)
            if (notification) {
                notification.metadata = { ...notification.metadata, ...baseMetadata };
                
                await docClient.send(new PutCommand({
                    TableName: NOTIFICATIONS_TABLE,
                    Item: {
                        id: randomUUID(),
                        topic_id: source.topic_id,
                        title: notification.title,
                        message: notification.message,
                        severity: notification.severity,
                        type: 'webhook',
                        metadata: notification.metadata,
                        status: 'new',
                        timestamp: new Date().toISOString()
                    }
                }));
            }
        }

        return createResponse({ message: "Webhook processed successfully" }, 200);

    } catch (error) {
        console.error("Error processing webhook:", error.message);
        return createErrorResponse("Internal server error", 500);
    }
};


// --- Helper Functions ---

function createResponse(data, statusCode = 200) {
    return {
        statusCode,
        headers: corsHeaders,
        body: data ? JSON.stringify(data) : ''
    };
}

function createErrorResponse(error, status = 400) {
    return createResponse({ error, timestamp: new Date().toISOString() }, status);
}

// --- Payload Transformers (Logig copied from Supabase function) ---

function shouldNotify(eventCode, success) {
    const isSuccess = success === 'true';
    const failureEvents = ['CAPTURE_FAILED', 'REFUND_FAILED', 'CHARGEBACK', 'NOTIFICATION_OF_CHARGEBACK', 'TOTAL_THROTTLE_REACHED'];
    const failureOnlyEvents = ['AUTHORISATION', 'CAPTURE', 'REFUND', 'CANCELLATION'];
    return failureEvents.includes(eventCode) || (failureOnlyEvents.includes(eventCode) && !isSuccess);
}

function transformAdyenPayload(payload) {
    const notificationItem = payload.notificationItems[0]?.NotificationRequestItem;
    if (!notificationItem) throw new Error("Invalid Adyen payload: Missing NotificationRequestItem");

    const { eventCode, success, amount, pspReference, merchantAccountCode, merchantReference, originalReference, reason } = notificationItem;

    if (!shouldNotify(eventCode, success)) return null;

    const title = `${eventCode} - ${merchantAccountCode}`;
    let messageLines = [`PSP: ${pspReference}`, `Merchant Ref: ${merchantReference}`];
    let severity = 'high';
    const formattedAmount = amount ? `${amount.currency} ${amount.value / 100}` : '';

    switch (eventCode) {
        case 'AUTHORISATION': messageLines = [`❌ Authorization Failed`, `Amount: ${formattedAmount}`, `PSP: ${pspReference}`, `Merchant Ref: ${merchantReference}`]; break;
        case 'CAPTURE': messageLines = [`❌ Capture Failed`, `Amount: ${formattedAmount}`, `PSP: ${pspReference}`, `Original: ${originalReference}`, `Merchant Ref: ${merchantReference}`]; break;
        case 'CAPTURE_FAILED': messageLines = [`❌ Capture Failed`, `PSP: ${pspReference}`, `Original: ${originalReference}`, `Merchant Ref: ${merchantReference}`, `Reason: ${reason || 'Not specified'}`]; break;
        case 'REFUND': messageLines = [`❌ Refund Failed`, `Amount: ${formattedAmount}`, `PSP: ${pspReference}`, `Original: ${originalReference}`, `Merchant Ref: ${merchantReference}`]; break;
        case 'REFUND_FAILED': messageLines = [`❌ Refund Failed`, `PSP: ${pspReference}`, `Original: ${originalReference}`, `Merchant Ref: ${merchantReference}`, `Reason: ${reason || 'Not specified'}`]; break;
        case 'CANCELLATION': messageLines = [`❌ Cancellation Failed`, `PSP: ${pspReference}`, `Merchant Ref: ${merchantReference}`]; break;
        case 'CHARGEBACK': messageLines = [`🚨 CHARGEBACK RECEIVED`, `PSP: ${pspReference}`, `Merchant Ref: ${merchantReference}`, `⚠️  Please review and supply defense documents ASAP`]; break;
        case 'NOTIFICATION_OF_CHARGEBACK': messageLines = [`🚨 CHARGEBACK NOTIFICATION`, `PSP: ${pspReference}`, `Merchant Ref: ${merchantReference}`, `⚠️  Please investigate and supply defense documents`]; break;
        case 'TOTAL_THROTTLE_REACHED': messageLines = [`🚨 THROTTLE LIMIT REACHED`, `PSP: ${pspReference}`, `Merchant Ref: ${merchantReference}`, `⚠️  Payment processing temporarily blocked`]; break;
        default: messageLines = [`❌ Event Failed: ${eventCode}`, `PSP: ${pspReference}`, `Merchant Ref: ${merchantReference}`]; break;
    }

    return {
        title,
        message: messageLines.join('\n'),
        severity,
        metadata: { merchantAccountCode, merchantReference, pspReference, eventCode, success: success === 'true', amount: formattedAmount, messageLines, failure: true }
    };
}

function transformGenericPayload(payload) {
    const isFailure = payload.severity?.toLowerCase() === 'high' || payload.status === 'failed' || payload.error;
    if (!isFailure) return null;

    const title = payload.eventName || payload.title || "Webhook Failure";
    let message = payload.message || payload.summary || payload.error;
    if (!message) {
        const payloadString = JSON.stringify(payload, null, 2);
        message = payloadString.length > 500 ? payloadString.substring(0, 500) + '...' : payloadString;
    }

    return {
        title,
        message,
        severity: 'high',
        metadata: { failure: true }
    };
}
