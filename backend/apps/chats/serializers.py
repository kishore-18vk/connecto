from rest_framework import serializers
from .models import Chat, Message, StarredMessage, MessageStatus, MessageReaction
from apps.accounts.serializers import UserSerializer

class MessageReactionSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)

    class Meta:
        model = MessageReaction
        fields = ['id', 'user', 'user_details', 'emoji']
        read_only_fields = ['id']

class MessageStatusSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)

    class Meta:
        model = MessageStatus
        fields = ['id', 'user', 'user_details', 'status', 'updated_at']
        read_only_fields = ['id', 'updated_at']

class MessageSerializer(serializers.ModelSerializer):
    sender_details = UserSerializer(source='sender', read_only=True)
    reactions = MessageReactionSerializer(many=True, read_only=True)
    statuses = MessageStatusSerializer(many=True, read_only=True)
    is_starred = serializers.SerializerMethodField()
    
    # Compatibility fields
    chat_room_id = serializers.IntegerField(source='chat.id', read_only=True)
    sender_id = serializers.IntegerField(source='sender.id', read_only=True)
    receiver_id = serializers.IntegerField(source='receiver.id', read_only=True, allow_null=True)
    message = serializers.CharField(source='content', read_only=True)
    is_sent = serializers.SerializerMethodField()
    is_delivered = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            'id', 'chat', 'chat_room_id', 'sender', 'sender_id', 'receiver', 'receiver_id',
            'sender_details', 'content', 'message', 'message_type',
            'media_url', 'parent_message', 'is_pinned', 'is_deleted_for_everyone',
            'is_sent', 'is_delivered', 'is_seen', 'created_at', 'updated_at',
            'reactions', 'statuses', 'is_starred'
        ]
        read_only_fields = ['id', 'sender', 'created_at', 'updated_at', 'is_deleted_for_everyone']

    def get_is_starred(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return StarredMessage.objects.filter(user=request.user, message=obj).exists()
        return False

    def get_is_sent(self, obj):
        return True

    def get_is_delivered(self, obj):
        return obj.statuses.filter(status__in=['DELIVERED', 'READ']).exists()

class ChatSerializer(serializers.ModelSerializer):
    participants_details = UserSerializer(source='participants', many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    group_details = serializers.SerializerMethodField()
    
    # Compatibility fields
    user1_id = serializers.SerializerMethodField()
    user2_id = serializers.SerializerMethodField()
    last_message_time = serializers.SerializerMethodField()
    user_info = serializers.SerializerMethodField()

    class Meta:
        model = Chat
        fields = [
            'id', 'type', 'participants', 'participants_details', 'created_at', 'updated_at',
            'last_message', 'unread_count', 'group_details',
            'user1_id', 'user2_id', 'last_message_time', 'user_info'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_last_message(self, obj):
        msg = obj.messages.order_by('-created_at').first()
        if msg:
            return MessageSerializer(msg, context=self.context).data
        return None

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.messages.exclude(sender=request.user).exclude(
                statuses__user=request.user, statuses__status='READ'
            ).count()
        return 0

    def get_group_details(self, obj):
        if obj.type == 'GROUP' and hasattr(obj, 'group_profile'):
            from apps.groups.serializers import GroupSerializer
            return GroupSerializer(obj.group_profile, context=self.context).data
        return None

    def get_user1_id(self, obj):
        pts = list(obj.participants.all().order_by('id'))
        return pts[0].id if len(pts) > 0 else None

    def get_user2_id(self, obj):
        pts = list(obj.participants.all().order_by('id'))
        return pts[1].id if len(pts) > 1 else None

    def get_last_message_time(self, obj):
        msg = obj.messages.order_by('-created_at').first()
        t = msg.created_at if msg else obj.updated_at
        return t.isoformat() if t else None

    def get_user_info(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            other_user = obj.participants.exclude(id=request.user.id).first()
            if other_user:
                return UserSerializer(other_user, context=self.context).data
        return None

