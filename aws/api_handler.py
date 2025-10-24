
import json
import boto3
import uuid
from datetime import datetime
from broadcast import broadcast_message

dynamodb = boto3.resource('dynamodb')

def get_user_from_event(event):
    return event.get('requestContext', {}).get('authorizer', {}).get('claims', {})

def make_response(status_code, body):
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        'body': json.dumps(body)
    }

def register_device_handler(event, context):
    user_info = get_user_from_event(event)
    user_id = user_info.get('sub')
    if not user_id:
        return make_response(401, {'error': 'Unauthorized'})

    try:
        body = json.loads(event.get('body', '{}'))
        player_id = body.get('playerId')

        if not player_id:
            return make_response(400, {'error': 'Missing playerId'})

        devices_table = dynamodb.Table('mcm-alerts-devices')
        device_item = {
            'player_id': player_id,
            'user_id': user_id,
            'created_at': datetime.utcnow().isoformat(),
        }
        devices_table.put_item(Item=device_item)

        return make_response(201, {'status': 'registered', 'playerId': player_id})

    except Exception as e:
        return make_response(500, {'error': str(e)})

def unregister_device_handler(event, context):
    user_info = get_user_from_event(event)
    user_id = user_info.get('sub')
    if not user_id:
        return make_response(401, {'error': 'Unauthorized'})

    try:
        player_id = event.get('pathParameters', {}).get('playerId')
        if not player_id:
            return make_response(400, {'error': 'Missing playerId in path'})

        devices_table = dynamodb.Table('mcm-alerts-devices')
        
        devices_table.delete_item(
            Key={'player_id': player_id},
            ConditionExpression="user_id = :uid",
            ExpressionAttributeValues={":uid": user_id}
        )

        return make_response(200, {'status': 'unregistered', 'playerId': player_id})

    except dynamodb.meta.client.exceptions.ConditionalCheckFailedException:
        return make_response(403, {'error': 'Forbidden: Device does not belong to user or does not exist.'})
    except Exception as e:
        return make_response(500, {'error': str(e)})

def add_comment_handler(event, context):
    user_info = get_user_from_event(event)
    user_id = user_info.get('sub')
    if not user_id: return make_response(401, {'error': 'Unauthorized'})

    try:
        body = json.loads(event.get('body', '{}'))
        notification_id = body.get('notification_id')
        text = body.get('text')

        if not notification_id or not text:
            return make_response(400, {'error': 'Missing notification_id or text'})

        comments_table = dynamodb.Table('mcm-alerts-comments')
        new_comment = {
            'notification_id': notification_id,
            'id': str(uuid.uuid4()),
            'user_id': user_id,
            'text': text,
            'created_at': datetime.utcnow().isoformat(),
        }
        comments_table.put_item(Item=new_comment)

        broadcast_message(event, {
            'type': 'NEW_COMMENT',
            'payload': new_comment
        })

        return make_response(201, new_comment)

    except Exception as e:
        return make_response(500, {'error': str(e)})

def update_notification_handler(event, context):
    user_info = get_user_from_event(event)
    user_id = user_info.get('sub')
    if not user_id: return make_response(401, {'error': 'Unauthorized'})

    try:
        notification_id = event.get('pathParameters', {}).get('notification_id')
        if not notification_id: return make_response(400, {'error': 'Missing ID'})

        body = json.loads(event.get('body', '{}'))
        
        notifications_table = dynamodb.Table('mcm-alerts-notifications')
        response = notifications_table.update_item(
            ReturnValues="ALL_NEW"
        )
        updated_attributes = response.get('Attributes', {})

        broadcast_message(event, {
            'type': 'NOTIFICATION_UPDATED',
            'payload': updated_attributes
        })

        return make_response(200, updated_attributes)

    except Exception as e:
        return make_response(500, {'error': str(e)})

def router(event, context):
    resource = event.get('resource')
    http_method = event.get('httpMethod')

    if http_method == 'OPTIONS':
        return make_response(200, {})

    if http_method == 'POST' and resource == '/devices':
        return register_device_handler(event, context)
    elif http_method == 'DELETE' and resource == '/devices/{playerId}':
        return unregister_device_handler(event, context)
    elif http_method == 'POST' and resource == '/comments':
        return add_comment_handler(event, context)
    elif http_method == 'PUT' and resource == '/notifications/{notification_id}':
        return update_notification_handler(event, context)

    return make_response(404, {'error': 'Not Found'})
