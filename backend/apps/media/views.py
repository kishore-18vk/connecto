import mimetypes
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import MediaFile
from .serializers import MediaFileSerializer
from .tasks import compress_media_task

class MediaUploadView(generics.CreateAPIView):
    serializer_class = MediaFileSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        uploaded_file = self.request.FILES['file']
        file_size = uploaded_file.size
        
        content_type = uploaded_file.content_type
        if content_type.startswith('image/'):
            file_type = 'IMAGE'
        elif content_type.startswith('video/'):
            file_type = 'VIDEO'
        elif content_type.startswith('audio/'):
            file_type = 'AUDIO'
        else:
            file_type = 'DOCUMENT'

        media_instance = serializer.save(
            uploaded_by=self.request.user,
            file_size=file_size,
            file_type=file_type
        )

        # Trigger Celery background task
        try:
            compress_media_task.delay(media_instance.id)
        except Exception:
            # Fallback if Celery is not running/available in dev
            pass
