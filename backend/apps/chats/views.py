from rest_framework import viewsets, status, filters, generics
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.db.models import Q
from .models import Chat, Message, StarredMessage, MessageStatus, MessageReaction
from .serializers import ChatSerializer, MessageSerializer

class ChatViewSet(viewsets.ModelViewSet):
    serializer_class = ChatSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Chat.objects.filter(participants=self.request.user).order_by('-updated_at')

    def create(self, request, *args, **kwargs):
        chat_type = request.data.get('type', 'DM')
        participants_ids = request.data.get('participants', [])
        
        if chat_type == 'DM':
            if not participants_ids or len(participants_ids) != 1:
                raise ValidationError("DM requires exactly one participant in the 'participants' list.")
            other_user_id = participants_ids[0]
            if int(other_user_id) == request.user.id:
                raise ValidationError("You cannot start a DM with yourself.")
                
            existing_chat = Chat.objects.filter(type='DM').filter(participants=request.user).filter(participants=other_user_id).first()
            if existing_chat:
                serializer = self.get_serializer(existing_chat)
                return Response(serializer.data, status=status.HTTP_200_OK)
                
            chat = Chat.objects.create(type='DM')
            chat.participants.add(request.user, other_user_id)
            chat.save()
            serializer = self.get_serializer(chat)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        elif chat_type == 'GROUP':
            raise ValidationError("Please use the /api/groups/ endpoint to create group chats.")
        
        return Response({"detail": "Invalid chat type"}, status=status.HTTP_400_BAD_REQUEST)

class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['content']

    def get_queryset(self):
        if self.detail:
            return Message.objects.filter(chat__participants=self.request.user)

        chat_id = self.request.query_params.get('chat')
        if not chat_id:
            raise ValidationError({"chat": "This query parameter is required."})
            
        chat = Chat.objects.filter(id=chat_id, participants=self.request.user).first()
        if not chat:
            raise PermissionDenied("You are not a participant in this chat.")
            
        return Message.objects.filter(chat=chat).exclude(deleted_by=self.request.user).order_by('created_at')

    def perform_create(self, serializer):
        chat_id = self.request.data.get('chat')
        chat = Chat.objects.filter(id=chat_id, participants=self.request.user).first()
        if not chat:
            raise PermissionDenied("You are not a participant in this chat.")
        message = serializer.save(sender=self.request.user)
        chat.save()

    @action(detail=True, methods=['post'])
    def react(self, request, pk=None):
        message = self.get_object()
        emoji = request.data.get('emoji')
        if not emoji:
            raise ValidationError("Emoji is required.")
        
        reaction, created = MessageReaction.objects.get_or_create(
            message=message, user=request.user,
            defaults={'emoji': emoji}
        )
        if not created:
            if reaction.emoji == emoji:
                reaction.delete()
            else:
                reaction.emoji = emoji
                reaction.save()
        
        from .serializers import MessageReactionSerializer
        reactions = MessageReaction.objects.filter(message=message)
        serializer = MessageReactionSerializer(reactions, many=True)
        return Response({"status": "reaction updated", "reactions": serializer.data})

    @action(detail=True, methods=['post'])
    def unreact(self, request, pk=None):
        message = self.get_object()
        MessageReaction.objects.filter(message=message, user=request.user).delete()
        from .serializers import MessageReactionSerializer
        reactions = MessageReaction.objects.filter(message=message)
        serializer = MessageReactionSerializer(reactions, many=True)
        return Response({"status": "reaction removed", "reactions": serializer.data})

    @action(detail=True, methods=['post'])
    def pin(self, request, pk=None):
        message = self.get_object()
        message.is_pinned = not message.is_pinned
        message.save()
        return Response({"status": "pin status toggled", "is_pinned": message.is_pinned})

    @action(detail=True, methods=['post'])
    def star(self, request, pk=None):
        message = self.get_object()
        starred, created = StarredMessage.objects.get_or_create(user=request.user, message=message)
        if not created:
            starred.delete()
            return Response({"status": "unstarred", "is_starred": False})
        return Response({"status": "starred", "is_starred": True})

    @action(detail=True, methods=['post'])
    def delete_for_me(self, request, pk=None):
        message = self.get_object()
        message.deleted_by.add(request.user)
        return Response({"status": "deleted for me"})

    @action(detail=True, methods=['post'])
    def delete_for_everyone(self, request, pk=None):
        message = self.get_object()
        if message.sender != request.user:
            raise PermissionDenied("You can only delete your own messages for everyone.")
        message.is_deleted_for_everyone = True
        message.content = "This message was deleted."
        message.media_url = None
        message.save()
        return Response({"status": "deleted for everyone"})

from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from apps.accounts.models import BlockedUser
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

User = get_user_model()

class ChatListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        chats = Chat.objects.filter(participants=request.user).exclude(deleted_by=request.user)
        serializer = ChatSerializer(chats, many=True, context={'request': request})
        data = list(serializer.data)
        # Sort by last_message_time descending
        data.sort(key=lambda x: x.get('last_message_time') or x.get('updated_at') or '', reverse=True)
        return Response(data, status=status.HTTP_200_OK)

class ChatDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, chat_id):
        chat = Chat.objects.filter(id=chat_id, participants=request.user).first()
        if not chat:
            return Response({"detail": "Chat not found."}, status=status.HTTP_404_NOT_FOUND)

        # Mark all messages in this chat from other senders as seen
        messages_to_update = Message.objects.filter(chat=chat).exclude(sender=request.user)
        for msg in messages_to_update:
            msg.is_seen = True
            msg.save()
            status_obj, created = MessageStatus.objects.get_or_create(message=msg, user=request.user)
            status_obj.status = 'READ'
            status_obj.save()

        messages = Message.objects.filter(chat=chat).exclude(deleted_by=request.user).order_by('created_at')
        serializer = MessageSerializer(messages, many=True, context={'request': request})
        return Response({
            "chat_id": chat.id,
            "type": chat.type,
            "messages": serializer.data
        }, status=status.HTTP_200_OK)

class SendMessageView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        chat_id = request.data.get('chat_id')
        receiver_id = request.data.get('receiver_id')
        message_content = request.data.get('message')

        if not message_content:
            return Response({"detail": "Message content is required."}, status=status.HTTP_400_BAD_REQUEST)

        chat = None
        if chat_id:
            chat = Chat.objects.filter(id=chat_id, participants=request.user).first()
            if not chat:
                return Response({"detail": "Chat not found."}, status=status.HTTP_404_NOT_FOUND)
            receiver = chat.participants.exclude(id=request.user.id).first()
        else:
            if not receiver_id:
                return Response({"detail": "Either chat_id or receiver_id is required."}, status=status.HTTP_400_BAD_REQUEST)
            
            receiver = User.objects.filter(id=receiver_id).first()
            if not receiver:
                return Response({"detail": "Receiver user not found."}, status=status.HTTP_404_NOT_FOUND)

            chat = Chat.objects.filter(type='DM').filter(participants=request.user).filter(participants=receiver).first()
            if not chat:
                chat = Chat.objects.create(type='DM')
                chat.participants.add(request.user, receiver)
                chat.save()

        if receiver:
            if BlockedUser.objects.filter(blocker=request.user, blocked=receiver).exists() or \
               BlockedUser.objects.filter(blocker=receiver, blocked=request.user).exists():
                return Response({"detail": "Cannot send message to this user."}, status=status.HTTP_400_BAD_REQUEST)

        message = Message.objects.create(
            chat=chat,
            sender=request.user,
            receiver=receiver,
            content=message_content,
            is_seen=False
        )
        chat.save()

        if receiver:
            MessageStatus.objects.create(message=message, user=receiver, status='SENT')

        channel_layer = get_channel_layer()
        serialized_msg = MessageSerializer(message, context={'request': request}).data
        
        for p in chat.participants.all():
            async_to_sync(channel_layer.group_send)(
                f"user_{p.id}",
                {
                    "type": "chat.message",
                    "message": serialized_msg
                }
            )

        return Response(serialized_msg, status=status.HTTP_201_CREATED)

class DeleteChatView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        chat_id = request.data.get('chat_id') or request.query_params.get('chat_id')
        if not chat_id:
            return Response({"detail": "chat_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        chat = Chat.objects.filter(id=chat_id, participants=request.user).first()
        if not chat:
            return Response({"detail": "Chat not found."}, status=status.HTTP_404_NOT_FOUND)

        chat.deleted_by.add(request.user)
        chat.save()
        return Response({"detail": "Chat deleted successfully from your list."}, status=status.HTTP_200_OK)

class UnreadCountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        chats = Chat.objects.filter(participants=request.user).exclude(deleted_by=request.user)
        total_unread = 0
        for chat in chats:
            total_unread += chat.messages.exclude(sender=request.user).exclude(
                statuses__user=request.user, statuses__status='READ'
            ).count()
        return Response({"unread_count": total_unread}, status=status.HTTP_200_OK)

class SendMessageAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        receiver_id = request.data.get('receiver_id')
        message_content = request.data.get('message')

        if not receiver_id or not message_content:
            return Response({"detail": "receiver_id and message are required."}, status=status.HTTP_400_BAD_REQUEST)

        receiver = User.objects.filter(id=receiver_id).first()
        if not receiver:
            return Response({"detail": "Receiver user not found."}, status=status.HTTP_404_NOT_FOUND)

        if BlockedUser.objects.filter(blocker=request.user, blocked=receiver).exists() or \
           BlockedUser.objects.filter(blocker=receiver, blocked=request.user).exists():
            return Response({"detail": "Cannot send message to this user."}, status=status.HTTP_400_BAD_REQUEST)

        # Check or create DM chat room
        chat = Chat.objects.filter(type='DM').filter(participants=request.user).filter(participants=receiver).first()
        if not chat:
            chat = Chat.objects.create(type='DM')
            chat.participants.add(request.user, receiver)
            chat.save()

        message = Message.objects.create(
            chat=chat,
            sender=request.user,
            receiver=receiver,
            content=message_content,
            is_seen=False
        )
        chat.save()

        # Create status
        MessageStatus.objects.create(message=message, user=receiver, status='SENT')

        # Broadcast via WebSockets
        channel_layer = get_channel_layer()
        serialized_msg = MessageSerializer(message, context={'request': request}).data

        for p in chat.participants.all():
            async_to_sync(channel_layer.group_send)(
                f"user_{p.id}",
                {
                    "type": "chat.message",
                    "message": serialized_msg
                }
            )

        return Response({
            "success": True,
            "message_id": message.id,
            "chat_room_id": chat.id
        }, status=status.HTTP_201_CREATED)

class ChatMessagesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, chat_id):
        chat = Chat.objects.filter(id=chat_id, participants=request.user).first()
        if not chat:
            return Response({"detail": "Chat not found."}, status=status.HTTP_404_NOT_FOUND)

        # Mark all messages in this chat from other senders as seen
        messages_to_update = Message.objects.filter(chat=chat).exclude(sender=request.user)
        for msg in messages_to_update:
            msg.is_seen = True
            msg.save()
            status_obj, created = MessageStatus.objects.get_or_create(message=msg, user=request.user)
            status_obj.status = 'READ'
            status_obj.save()

            # Also trigger a seen broadcast through websocket for read receipt
            channel_layer = get_channel_layer()
            for p in chat.participants.all():
                if p.id != request.user.id:
                    async_to_sync(channel_layer.group_send)(
                        f"user_{p.id}",
                        {
                            "type": "chat.receipt",
                            "chat_id": chat.id,
                            "user_id": request.user.id,
                            "message_id": msg.id,
                            "status": "READ"
                        }
                    )

        messages = Message.objects.filter(chat=chat).exclude(deleted_by=request.user).order_by('created_at')
        serializer = MessageSerializer(messages, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

