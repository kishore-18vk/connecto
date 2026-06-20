from rest_framework import serializers
from .models import MediaFile
from apps.accounts.serializers import UserSerializer

class MediaFileSerializer(serializers.ModelSerializer):
    uploaded_by_details = UserSerializer(source='uploaded_by', read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = MediaFile
        fields = ['id', 'file', 'file_url', 'file_type', 'file_size', 'uploaded_by', 'uploaded_by_details', 'created_at']
        read_only_fields = ['id', 'file_size', 'uploaded_by', 'created_at']

    def get_file_url(self, obj):
        request = self.context.get('request')
        if request and obj.file:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url if obj.file else None
