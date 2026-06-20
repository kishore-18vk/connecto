from rest_framework import serializers
from .models import Group, GroupMember
from apps.accounts.serializers import UserSerializer

class GroupMemberSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)

    class Meta:
        model = GroupMember
        fields = ['id', 'user', 'user_details', 'role', 'joined_at']
        read_only_fields = ['id', 'joined_at']

class GroupSerializer(serializers.ModelSerializer):
    members = GroupMemberSerializer(many=True, read_only=True)
    created_by_details = UserSerializer(source='created_by', read_only=True)
    chat_id = serializers.IntegerField(source='chat.id', read_only=True)
    is_admin = serializers.SerializerMethodField()
    profile_picture = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = ['id', 'chat_id', 'name', 'description', 'profile_picture', 'created_by', 'created_by_details', 'invite_code', 'members', 'is_admin', 'created_at']
        read_only_fields = ['id', 'chat_id', 'created_by', 'invite_code', 'created_at']

    def get_profile_picture(self, obj):
        if obj.profile_picture:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile_picture.url)
            return obj.profile_picture.url
        return None

    def get_is_admin(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return GroupMember.objects.filter(group=obj, user=request.user, role__in=['ADMIN', 'CREATOR']).exists()
        return False
