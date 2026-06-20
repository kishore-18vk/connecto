from rest_framework import serializers
from .models import Status, StatusView
from apps.accounts.serializers import UserSerializer

class StatusViewSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)

    class Meta:
        model = StatusView
        fields = ['id', 'user', 'user_details', 'viewed_at']
        read_only_fields = ['id', 'viewed_at']

class StatusSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)
    views = StatusViewSerializer(many=True, read_only=True)
    view_count = serializers.SerializerMethodField()
    media_file = serializers.SerializerMethodField()

    class Meta:
        model = Status
        fields = ['id', 'user', 'user_details', 'media_type', 'media_file', 'text_content', 'background_color', 'views', 'view_count', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']

    def get_media_file(self, obj):
        if obj.media_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.media_file.url)
            return obj.media_file.url
        return None

    def get_view_count(self, obj):
        return obj.views.count()
