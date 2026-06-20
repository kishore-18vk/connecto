from rest_framework import serializers
from .models import User, UserProfile, BlockedUser

class UserProfileSerializer(serializers.ModelSerializer):
    profile_picture = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = ['bio', 'profile_picture', 'privacy_last_seen', 'privacy_profile_picture', 'privacy_status', 'privacy_email', 'date_joined']

    def get_profile_picture(self, obj):
        if obj.profile_picture:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile_picture.url)
            return obj.profile_picture.url
        return obj.user.avatar_url

class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'google_id', 'nickname', 'first_name', 'last_name', 'is_online', 'last_seen', 'avatar_url', 'profile']
        read_only_fields = ['id', 'email', 'google_id', 'is_online', 'last_seen', 'avatar_url']

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            if request.user.id == instance.id:
                return ret
            
            privacy = 'PRIVATE'
            if hasattr(instance, 'profile'):
                privacy = instance.profile.privacy_email
            
            if privacy == 'PRIVATE':
                ret['email'] = ''
            elif privacy == 'FRIENDS':
                from apps.contacts.models import Contact
                is_contact = Contact.objects.filter(user=instance, contact=request.user).exists()
                if not is_contact:
                    ret['email'] = ''
        else:
            ret['email'] = ''
        return ret

class BlockedUserSerializer(serializers.ModelSerializer):
    blocked_user_details = UserSerializer(source='blocked', read_only=True)

    class Meta:
        model = BlockedUser
        fields = ['id', 'blocked', 'blocked_user_details', 'created_at']
        read_only_fields = ['id', 'created_at']
