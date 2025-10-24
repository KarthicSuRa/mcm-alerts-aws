import json
import boto3
import os

dynamodb = boto3.resource('dynamodb')
TABLE_NAME = os.environ.get('WEBSOCKET_CONNECTIONS_TABLE', 'mcm-alerts-websocket-connections')
connections_table = dynamodb.Table(TABLE_NAME)

def make_response(status_code, body):
    """Helper to create a standard API Gateway response."""
    return {
        'statusCode': status_code,
        'body': json.dumps(body)
    }

def connect_handler(event, context):
    """
    Handles new WebSocket connections.
    Stores the connectionId in DynamoDB.
    """
    connection_id = event['requestContext'].get('connectionId')
    if not connection_id:
        return make_response(400, {'error': 'Missing connectionId'})

    try:
        connections_table.put_item(
            Item={
                'connectionId': connection_id
            }
        )
        print(f"CONNECT: New connection {connection_id} stored.")
        return make_response(200, {'message': 'Connected.'})
    except Exception as e:
        print(f"ERROR: Failed to store connection {connection_id}: {e}")
        return make_response(500, {'error': 'Connection failed.'})

def disconnect_handler(event, context):
    """
    Handles WebSocket disconnections.
    Deletes the connectionId from DynamoDB.
    """
    connection_id = event['requestContext'].get('connectionId')
    if not connection_id:
        return make_response(400, {'error': 'Missing connectionId'})

    try:
        connections_table.delete_item(
            Key={
                'connectionId': connection_id
            }
        )
        print(f"DISCONNECT: Connection {connection_id} removed.")
        return make_response(200, {'message': 'Disconnected.'})
    except Exception as e:
        print(f"ERROR: Failed to remove connection {connection_id}: {e}")
        return make_response(500, {'error': 'Disconnection failed.'})

def default_handler(event, context):
    """
    Handles any messages sent from the client that are not for a specific route.
    """
    connection_id = event['requestContext'].get('connectionId')
    print(f"DEFAULT: Received message from {connection_id}, but no action configured.")
    # You could add logic here to handle incoming messages if needed, e.g., ping/pong.
    return make_response(200, {'message': 'Message received.'})
