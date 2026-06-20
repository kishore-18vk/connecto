import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.db.models import Q
from .models import Chat, Message, MessageStatus, MessageReaction
from apps.contacts.models import Contact

User = get_user_model()

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        
        if self.user.is_anonymous:
            await self.close()
            return

        self.user_group_name = f"user_{self.user.id}"
        
        # Join personal user channel group
        await self.channel_layer.group_add(
            self.user_group_name,
            self.channel_name
        )
        await self.accept()

        # Update status to Online
        await self.update_user_presence(True)
        await self.broadcast_presence(True)

        # Mark all pending unread messages as delivered
        updated_chats = await self.mark_all_unread_messages_as_delivered()
        for chat in updated_chats:
            participant_ids = await self.get_participants(chat.id)
            for pid in participant_ids:
                if pid != self.user.id:
                    await self.channel_layer.group_send(
                        f"user_{pid}",
                        {
                            "type": "chat.receipt",
                            "chat_id": chat.id,
                            "user_id": self.user.id,
                            "status": "DELIVERED"
                        }
                    )

    async def disconnect(self, close_code):
        if hasattr(self, 'user_group_name'):
            # Leave user group
            await self.channel_layer.group_discard(
                self.user_group_name,
                self.channel_name
            )
            # Update status to Offline
            await self.update_user_presence(False)
            await self.broadcast_presence(False)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            action = data.get("action")
            
            if action == "message":
                await self.handle_send_message(data)
            elif action == "typing":
                await self.handle_typing(data)
            elif action == "read":
                await self.handle_read_receipt(data)
            elif action == "deliver":
                await self.handle_delivery_receipt(data)
            elif action == "call_signal":
                await self.handle_call_signal(data)
        except Exception as e:
            await self.send(text_data=json.dumps({
                "error": str(e)
            }))

    # Handlers for incoming events

    async def handle_send_message(self, data):
        chat_id = data.get("chat_id")
        content = data.get("content")
        message_type = data.get("message_type", "TEXT")
        media_url = data.get("media_url")
        parent_id = data.get("parent_message_id")

        # Save message to database
        serialized_msg, participant_ids = await self.save_message_to_db(
            chat_id, content, message_type, media_url, parent_id
        )

        if not serialized_msg:
            return

        # Broadcast to all chat participants
        for pid in participant_ids:
            await self.channel_layer.group_send(
                f"user_{pid}",
                {
                    "type": "chat.message",
                    "message": serialized_msg
                }
            )

    async def handle_typing(self, data):
        chat_id = data.get("chat_id")
        is_typing = data.get("is_typing", False)
        
        participant_ids = await self.get_participants(chat_id)
        for pid in participant_ids:
            if pid != self.user.id:
                await self.channel_layer.group_send(
                    f"user_{pid}",
                    {
                        "type": "chat.typing",
                        "chat_id": chat_id,
                        "user_id": self.user.id,
                        "is_typing": is_typing
                    }
                )

    async def handle_read_receipt(self, data):
        chat_id = data.get("chat_id")
        participant_ids, msg_ids = await self.mark_messages_as_read(chat_id)
        
        for pid in participant_ids:
            if pid != self.user.id:
                await self.channel_layer.group_send(
                    f"user_{pid}",
                    {
                        "type": "chat.receipt",
                        "chat_id": chat_id,
                        "user_id": self.user.id,
                        "status": "READ",
                        "msg_ids": msg_ids
                    }
                )

    async def handle_delivery_receipt(self, data):
        chat_id = data.get("chat_id")
        participant_ids, msg_ids = await self.mark_messages_as_delivered(chat_id)
        
        for pid in participant_ids:
            if pid != self.user.id:
                await self.channel_layer.group_send(
                    f"user_{pid}",
                    {
                        "type": "chat.receipt",
                        "chat_id": chat_id,
                        "user_id": self.user.id,
                        "status": "DELIVERED",
                        "msg_ids": msg_ids
                    }
                )

    async def handle_call_signal(self, data):
        receiver_id = data.get("receiver_id")
        signal = data.get("signal")
        call_type = data.get("call_type") # VOICE or VIDEO
        
        if receiver_id:
            await self.channel_layer.group_send(
                f"user_{receiver_id}",
                {
                    "type": "call.signal",
                    "sender_id": self.user.id,
                    "signal": signal,
                    "call_type": call_type
                }
            )

    # Methods executing group_send broadcasts

    async def chat_message(self, event):
        msg_data = event["message"]
        # Original format for react client
        await self.send(text_data=json.dumps({
            "type": "message",
            "message": msg_data
        }))
        # Prompt-specified format
        await self.send(text_data=json.dumps({
            "type": "chat_message",
            "sender_id": msg_data.get("sender_id") or msg_data.get("sender"),
            "receiver_id": msg_data.get("receiver_id") or msg_data.get("receiver"),
            "message": msg_data.get("message") or msg_data.get("content")
        }))

    async def chat_typing(self, event):
        # Combined message supporting both formats
        await self.send(text_data=json.dumps({
            "type": "typing",
            "chatId": event["chat_id"],
            "user_id": event["user_id"],
            "is_typing": event["is_typing"]
        }))

    async def chat_receipt(self, event):
        # Send original format
        await self.send(text_data=json.dumps({
            "type": "receipt",
            "chat_id": event["chat_id"],
            "user_id": event["user_id"],
            "status": event["status"],
            "msg_ids": event.get("msg_ids", [])
        }))
        # Send prompt-specified message_seen format for read statuses
        if event["status"] == "READ":
            for mid in event.get("msg_ids", []):
                await self.send(text_data=json.dumps({
                    "type": "message_seen",
                    "message_id": mid
                }))

    async def call_signal(self, event):
        await self.send(text_data=json.dumps({
            "type": "call_signal",
            "sender_id": event["sender_id"],
            "signal": event["signal"],
            "call_type": event["call_type"]
        }))

    async def presence_update(self, event):
        # Original format
        await self.send(text_data=json.dumps({
            "type": "presence",
            "user_id": event["user_id"],
            "is_online": event["is_online"],
            "last_seen": event["last_seen"]
        }))
        # Prompt-specified user_online event
        if event["is_online"]:
            await self.send(text_data=json.dumps({
                "type": "user_online",
                "user_id": event["user_id"]
            }))

    # Helper presence broadcasts

    async def broadcast_presence(self, is_online):
        contact_ids = await self.get_user_contacts_list()
        last_seen_str = timezone.now().isoformat() if not is_online else None
        
        for cid in contact_ids:
            await self.channel_layer.group_send(
                f"user_{cid}",
                {
                    "type": "presence.update",
                    "user_id": self.user.id,
                    "is_online": is_online,
                    "last_seen": last_seen_str
                }
            )

    # Database synchronizers

    @database_sync_to_async
    def update_user_presence(self, is_online):
        user = User.objects.get(id=self.user.id)
        user.is_online = is_online
        if not is_online:
            user.last_seen = timezone.now()
        user.save()

    @database_sync_to_async
    def get_user_contacts_list(self):
        return list(Contact.objects.filter(contact=self.user).values_list('user_id', flat=True))

    @database_sync_to_async
    def get_participants(self, chat_id):
        try:
            chat = Chat.objects.get(id=chat_id)
            return list(chat.participants.values_list('id', flat=True))
        except Chat.DoesNotExist:
            return []

    @database_sync_to_async
    def save_message_to_db(self, chat_id, content, message_type, media_url, parent_id):
        try:
            chat = Chat.objects.get(id=chat_id, participants=self.user)
            parent = Message.objects.get(id=parent_id) if parent_id else None
            
            message = Message.objects.create(
                chat=chat,
                sender=self.user,
                content=content,
                message_type=message_type,
                media_url=media_url,
                parent_message=parent
            )
            chat.save()

            # Create message status for other participants
            for user in chat.participants.all():
                if user != self.user:
                    MessageStatus.objects.create(
                        message=message,
                        user=user,
                        status='SENT'
                    )

            # Build simple serialized data
            from .serializers import MessageSerializer
            data = MessageSerializer(message).data
            return data, list(chat.participants.values_list('id', flat=True))
        except Exception as e:
            print(f"Error saving message: {e}")
            return None, []

    @database_sync_to_async
    def mark_messages_as_read(self, chat_id):
        try:
            chat = Chat.objects.get(id=chat_id, participants=self.user)
            messages = Message.objects.filter(chat=chat).exclude(sender=self.user)
            msg_ids = []
            for msg in messages:
                if not msg.is_seen:
                    msg.is_seen = True
                    msg.save()
                status_obj, created = MessageStatus.objects.get_or_create(message=msg, user=self.user)
                if status_obj.status != 'READ':
                    status_obj.status = 'READ'
                    status_obj.save()
                msg_ids.append(msg.id)
            return list(chat.participants.values_list('id', flat=True)), msg_ids
        except Exception:
            return [], []

    @database_sync_to_async
    def mark_messages_as_delivered(self, chat_id):
        try:
            chat = Chat.objects.get(id=chat_id, participants=self.user)
            messages = Message.objects.filter(chat=chat).exclude(sender=self.user)
            msg_ids = []
            for msg in messages:
                status_obj, created = MessageStatus.objects.get_or_create(message=msg, user=self.user)
                if status_obj.status != 'READ' and status_obj.status != 'DELIVERED':
                    status_obj.status = 'DELIVERED'
                    status_obj.save()
                msg_ids.append(msg.id)
            return list(chat.participants.values_list('id', flat=True)), msg_ids
        except Exception:
            return [], []

    @database_sync_to_async
    def mark_all_unread_messages_as_delivered(self):
        try:
            chats = Chat.objects.filter(participants=self.user)
            updated_chats = []
            for chat in chats:
                messages = Message.objects.filter(chat=chat).exclude(sender=self.user)
                has_updated = False
                for msg in messages:
                    status_obj, created = MessageStatus.objects.get_or_create(message=msg, user=self.user)
                    if status_obj.status not in ['DELIVERED', 'READ']:
                        status_obj.status = 'DELIVERED'
                        status_obj.save()
                        has_updated = True
                if has_updated:
                    updated_chats.append(chat)
            return updated_chats
        except Exception as e:
            print("Error marking all as delivered on connect:", e)
            return []

