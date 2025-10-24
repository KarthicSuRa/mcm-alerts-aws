import boto3
import json
import os

dynamodb = boto3.resource('dynamodb')
WEBSOCKET_CONNECTIONS_TABLE = os.environ.get('WEBSOCKET_CONNECTIONS_TABLE', 'mcm-alerts-websocket-connections')
connections_table = dynamodb.Table(WEBSOCKET_CONNECTIONS_TABLE)

def broadcast_message(event, payload):
    """
    Broadcasts a payload to all connected WebSocket clients.
    """
    try:
        # 1. Get the ApiGatewayManagementApi client
        endpoint_url = f"https://{event['requestContext']['domainName']}/{event['requestContext']['stage']}"
        gatewayapi = boto3.client("apigatewaymanagementapi", endpoint_url=endpoint_url)

        # 2. Get all active connections from DynamoDB
        response = connections_table.scan(ProjectionExpression='connectionId')
        connection_ids = [item['connectionId'] for item in response.get('Items', [])]
        print(f"BROADCAST: Found {len(connection_ids)} connections to broadcast to.")

        # 3. Formatted message payload as a JSON string
        message = json.dumps(payload)

        # 4. Send the message to each connection
        for connection_id in connection_ids:
            try:
                gatewayapi.post_to_connection(
                    ConnectionId=connection_id,
                    Data=message
                )
                print(f"BROADCAST: Message sent to {connection_id}.")
            except gatewayapi.exceptions.GoneException:
                # 5. If the connection is gone, delete it from the table
                print(f"BROADCAST: Connection {connection_id} is gone. Deleting.")
                connections_table.delete_item(Key={'connectionId': connection_id})
            except Exception as e:
                print(f"BROADCAST: Failed to send to {connection_id}: {e}")

    except Exception as e:
        print(f"BROADCAST: Overall broadcast failed: {e}")
