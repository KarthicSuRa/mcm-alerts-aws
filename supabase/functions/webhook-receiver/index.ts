import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS headers to allow requests from any origin
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Transforms a raw Adyen webhook payload into a standardized notification format.
 * @param payload The raw Adyen webhook payload.
 * @returns A structured object for creating a notification.
 */
function transformAdyenPayload(payload: any): { title: string; message: string; severity: 'low' | 'medium' | 'high' } {
    const notificationItem = payload.notificationItems[0]?.NotificationRequestItem;
    if (!notificationItem) {
        throw new Error("Invalid Adyen payload: Missing NotificationRequestItem");
    }

    const {
        eventCode,
        success,
        amount,
        pspReference,
        originalReference,
        reason
    } = notificationItem;

    const isSuccess = success === 'true';
    let title = `Adyen Event: ${eventCode}`;
    let message = `PSP Reference: ${pspReference}.`;
    let severity: 'low' | 'medium' | 'high' = isSuccess ? 'medium' : 'high';

    const formattedAmount = amount ? `${amount.currency} ${amount.value / 100}` : '';

    switch (eventCode) {
        case 'AUTHORISATION':
            title = isSuccess ? 'Payment Authorized' : 'Payment Failed';
            message = `A payment authorization for ${formattedAmount} was ${isSuccess ? 'successful' : 'unsuccessful'}. ${message}`;
            break;
        case 'CAPTURE':
            title = isSuccess ? 'Payment Captured' : 'Capture Failed';
            message = `Capture for ${formattedAmount} was ${isSuccess ? 'successful' : 'unsuccessful'}. Original PSP Reference: ${originalReference || pspReference}`;
            break;
        case 'CAPTURE_FAILED':
            title = 'Payment Capture Failed';
            message = `The capture for payment with PSP reference ${originalReference} failed. Reason: ${reason || 'Not specified'}`;
            severity = 'high';
            break;
        case 'REFUND':
            title = isSuccess ? 'Refund Successful' : 'Refund Failed';
            message = `A refund of ${formattedAmount} was ${isSuccess ? 'processed successfully' : 'unsuccessful'}. Original PSP Reference: ${originalReference}`;
            break;
        case 'REFUND_FAILED':
            title = 'Refund Failed';
            message = `The refund for payment with PSP reference ${originalReference} failed at the scheme level. Reason: ${reason || 'Not specified'}`;
            severity = 'high';
            break;
        case 'CHARGEBACK':
            title = 'Chargeback Received';
            message = `A chargeback was initiated for payment ${pspReference}. Please review and supply defense documents.`;
            severity = 'high';
            break;
        case 'NOTIFICATION_OF_CHARGEBACK':
            title = 'Notification of Chargeback';
            message = `A dispute has been opened for payment ${pspReference}. Please investigate and supply defense documents.`;
            severity = 'high';
            break;
        case 'REPORT_AVAILABLE':
            title = 'New Report Available';
            message = `A new report is available for download. Report name: ${pspReference}`;
            severity = 'low';
            break;
        default:
            title = `New Adyen Event: ${eventCode}`;
            message = `Received a new unhandled event '${eventCode}'. PSP Reference: ${pspReference}`;
            severity = 'low';
            break;
    }

    return { title, message, severity };
}

serve(async (req) => {
  // Handle preflight OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Use the service_role key to create a client with admin privileges
    const adminSupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const sourceId = url.searchParams.get("source_id");

    if (!sourceId) {
      return new Response(JSON.stringify({ error: "Missing source_id parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Validate the source_id and get the linked topic_id and source_type
    const { data: source, error: sourceError } = await adminSupabaseClient
      .from("webhook_sources")
      .select("id, source_type, topic_id")
      .eq("id", sourceId)
      .single();

    if (sourceError || !source) {
      return new Response(JSON.stringify({ error: "Invalid or unauthorized source_id" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const payload = await req.json();

    // Store the raw event
    await adminSupabaseClient.from("webhook_events").insert([{ source_id: sourceId, payload }]);

    // If a topic is linked, transform and create a notification
    if (source.topic_id) {
        let notification;

        // === TRANSFORMATION LOGIC ===
        if (source.source_type === 'adyen') {
            notification = transformAdyenPayload(payload);
        } else {
            // Default transformation for other source_types
            notification = {
                title: "New Webhook Event Received",
                message: `Payload received for source: ${source.id}`,
                severity: 'low',
            };
        }

        // Insert the new notification
        const { error: notificationError } = await adminSupabaseClient.from("notifications").insert([
            {
                topic_id: source.topic_id,
                title: notification.title,
                message: notification.message,
                severity: notification.severity,
                type: 'webhook',
            },
        ]);

        if (notificationError) {
            console.error("Error creating notification:", notificationError);
            // We don't block the webhook just because notification failed
        }
    }

    return new Response(JSON.stringify({ message: "Webhook processed successfully" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("Error processing webhook:", error.message);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
