/**
 * Netlify Function Proxy for OCI Agent
 * * Purpose: This serverless function securely forwards the client's request to 
 * the OCI Agent at a raw IP address (158.178.153.59). It is critical because 
 * it disables SSL certificate validation (rejectUnauthorized: false), allowing 
 * it to successfully connect to the self-signed HTTPS server, thus solving 
 * the ERR_CERT_AUTHORITY_INVALID error the browser was seeing.
 * * Dependencies: Requires 'node-fetch' 
 */

import fetch from 'node-fetch';
import https from 'https'; // Node.js built-in module

// --- Configuration ---
// The target HTTPS IP address where the OCI agent is running
const OCI_AGENT_URL = 'https://158.178.153.59/api/run-flow';

// CRITICAL: This agent configuration disables the SSL certificate check.
const agent = new https.Agent({
    rejectUnauthorized: false
});

exports.handler = async (event) => {
    // 1. Validate request method
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: "Method Not Allowed. Only POST is accepted." }),
        };
    }

    try {
        // 2. Parse the request body coming from the React client
        const clientRequestBody = JSON.parse(event.body);

        // 3. Forward the structured request body to the OCI Agent
        const proxyResponse = await fetch(OCI_AGENT_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
            },
            // The body contains the execution plan and target URL
            body: JSON.stringify(clientRequestBody),
            // Use the agent configured to bypass certificate validation
            agent: agent 
        });

        // 4. Handle non-200 responses from the OCI agent
        if (!proxyResponse.ok) {
            // Attempt to parse error body as text if JSON fails
            const errorBody = await proxyResponse.text();
            
            return {
                statusCode: proxyResponse.status,
                body: JSON.stringify({ 
                    error: "OCI Agent reported an error.", 
                    details: errorBody.substring(0, 200) // Truncate long error messages
                }),
            };
        }

        // 5. Return the successful response body from the OCI agent back to the client
        const data = await proxyResponse.json();
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        };

    } catch (error) {
        console.error("Proxy Function Execution Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: "Netlify Proxy failed to process or forward the request.", 
                details: error.message 
            }),
        };
    }
};