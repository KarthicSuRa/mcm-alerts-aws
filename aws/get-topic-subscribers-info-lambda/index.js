const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand, BatchGetCommand } = require("@aws-sdk/lib-dynamodb");

// --- AWS and Environment Configuration ---
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TOPIC_SUBSCRIPTIONS_TABLE = process.env.TOPIC_SUBSCRIPTIONS_TABLE;
const PROFILES_TABLE = process.env.PROFILES_TABLE;

// --- CORS Headers ---
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// --- Main Lambda Handler ---
exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return createResponse(null, 204);
    }

    try {
        const { topic_id } = JSON.parse(event.body);
        if (!topic_id) {
            return createErrorResponse('`topic_id` is required.', 400);
        }

        // Step 1: Fetch user_ids from the topic_subscriptions table using the GSI.
        const { Items: subscriptions } = await docClient.send(new QueryCommand({
            TableName: TOPIC_SUBSCRIPTIONS_TABLE,
            IndexName: 'topic_id-index', // Assumes a GSI on topic_id
            KeyConditionExpression: 'topic_id = :topic_id',
            ExpressionAttributeValues: { ':topic_id': topic_id }
        }));

        if (!subscriptions || subscriptions.length === 0) {
            return createResponse([]); // No subscribers, return empty array
        }

        const userIds = subscriptions.map((sub) => sub.user_id);

        // Step 2: Batch fetch the full profiles for the collected user_ids.
        // DynamoDB BatchGetItem has a limit of 100 items.
        if (userIds.length > 100) {
             console.warn(`Query for topic ${topic_id} has ${userIds.length} subscribers, but we are only fetching the first 100 profiles due to API limits.`);
             // For simplicity, we truncate. In a production system, you might loop through batches.
             userIds.splice(100);
        }

        const keys = userIds.map(id => ({ id: id }));

        const { Responses } = await docClient.send(new BatchGetCommand({
            RequestItems: {
                [PROFILES_TABLE]: {
                    Keys: keys,
                    ProjectionExpression: "id, full_name, email" // Specify attributes to fetch
                }
            }
        }));

        const profiles = Responses[PROFILES_TABLE] || [];

        // Return the list of profiles.
        return createResponse(profiles);

    } catch (error) {
        console.error("Function execution failed:", error);
        return createErrorResponse('Function execution failed.', 500, { message: error.message });
    }
};

// --- Helper Functions ---

function createResponse(data, statusCode = 200) {
    return {
        statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    };
}

function createErrorResponse(error, status = 400, details = {}) {
    return createResponse({ error, ...details }, status);
}
