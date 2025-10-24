const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, BatchWriteItemCommand } = require("@aws-sdk/lib-dynamodb");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");

// --- AWS and Environment Configuration ---
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const lambdaClient = new LambdaClient({});

const MONITORED_SITES_TABLE = process.env.MONITORED_SITES_TABLE;
const PING_LOGS_TABLE = process.env.PING_LOGS_TABLE;
const NOTIFICATION_LAMBDA_NAME = process.env.NOTIFICATION_LAMBDA_NAME; // The name of the create-notification lambda

const FAKE_USER_AGENT = 'MCM Monitor Alerts';

// --- Main Lambda Handler ---
exports.handler = async (event) => {
    console.log(`Site monitoring function triggered. Event: ${JSON.stringify(event)}`);

    try {
        // 1. Fetch active sites from DynamoDB
        const { Items: sites } = await docClient.send(new ScanCommand({
            TableName: MONITORED_SITES_TABLE,
            FilterExpression: "#status = :status",
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: { ":status": "active" }
        }));

        if (!sites || sites.length === 0) {
            console.log("No active sites to monitor.");
            return { statusCode: 200, body: JSON.stringify({ message: "No active sites to monitor." }) };
        }

        console.log(`Found ${sites.length} active sites to monitor.`);

        // 2. Check each site
        const checkPromises = sites.map(checkSite);
        const results = await Promise.all(checkPromises);
        console.log("All site checks completed.");

        // 3. Trigger notifications and insert logs in parallel
        await Promise.all([
            triggerNotifications(results, sites),
            insertPingLogs(results)
        ]);
        
        return {
            statusCode: 200,
            body: JSON.stringify({ message: `Successfully checked ${sites.length} sites.` })
        };

    } catch (error) {
        console.error('An unexpected error occurred in the site monitoring function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};

// --- Helper Functions ---

async function checkSite(site) {
    const start = Date.now();
    const checked_at = new Date().toISOString();
    let status_code = 0;
    let is_up = false;
    let response_time_ms = 0;
    let status_text = '';
    let error_message = null;

    try {
        console.log(`Checking "${site.name}"...`);
        const response = await fetch(site.url, {
            method: 'GET',
            headers: { 'User-Agent': FAKE_USER_AGENT },
            redirect: 'follow'
        });
        response_time_ms = Date.now() - start;
        status_code = response.status;
        status_text = response.statusText;
        is_up = response.status >= 200 && response.status < 400;

        if (!is_up) {
            error_message = `Server responded with status: ${status_code} ${status_text}`;
            console.log(`✓ Result for "${site.name}": Status ${status_code} (${response_time_ms}ms) - DOWN`);
        } else {
            console.log(`✓ Result for "${site.name}": Status ${status_code} (${response_time_ms}ms)`);
        }
    } catch (e) {
        response_time_ms = Date.now() - start;
        error_message = e.message;
        is_up = false;
        console.error(`✗ Failure for "${site.name}": ${e.message} (${response_time_ms}ms)`);
    }

    return {
        site_id: site.id,
        checked_at,
        is_up,
        response_time_ms,
        status_code,
        status_text,
        error_message
    };
}

async function triggerNotifications(results, sites) {
    const downSiteResults = results.filter(result => !result.is_up);
    if (downSiteResults.length === 0) return;

    console.log(`Found ${downSiteResults.length} down sites. Triggering notifications...`);

    const notificationPromises = downSiteResults.map(result => {
        const site = sites.find(s => s.id === result.site_id);
        if (!site) {
            console.error(`Could not find site with ID ${result.site_id} for notification.`);
            return Promise.resolve();
        }

        const payload = {
            title: `Site Down Alert: ${site.name}`,
            message: `The monitored site "${site.name}" was detected as down. Error: ${result.error_message || 'No details available.'}`,
            severity: 'high',
            type: 'site_alert',
            site: site.name,
            topic_name: 'Site Monitoring' // Ensure this topic exists in your topics table
        };

        const invokeParams = {
            FunctionName: NOTIFICATION_LAMBDA_NAME,
            InvocationType: 'Event', // Asynchronous invocation
            Payload: JSON.stringify({ httpMethod: 'POST', body: JSON.stringify(payload) })
        };

        console.log(`Invoking '${NOTIFICATION_LAMBDA_NAME}' for site: ${site.name}`);
        return lambdaClient.send(new InvokeCommand(invokeParams));
    });

    const results = await Promise.allSettled(notificationPromises);
    results.forEach((res, index) => {
        if(res.status === 'rejected'){
             const site = sites.find(s => s.id === downSiteResults[index].site_id);
             console.error(`Error invoking notification for ${site?.name}:`, res.reason);
        }
    });
}

async function insertPingLogs(results) {
    if (results.length === 0) return;

    // DynamoDB BatchWriteItem has a limit of 25 items per request.
    const batchSize = 25;
    for (let i = 0; i < results.length; i += batchSize) {
        const batch = results.slice(i, i + batchSize);
        const putRequests = batch.map(item => ({
            PutRequest: {
                Item: item
            }
        }));

        const command = new BatchWriteItemCommand({
            RequestItems: {
                [PING_LOGS_TABLE]: putRequests
            }
        });

        try {
            await docClient.send(command);
            console.log(`✅ Successfully inserted ${batch.length} logs into the database.`);
        } catch (insertError) {
            console.error('Error bulk inserting logs:', insertError);
            // Non-fatal, don't throw, just log it.
        }
    }
}
