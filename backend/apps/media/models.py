from django.db import models
from django.conf import settings

class MediaFile(models.Model):
    FILE_TYPES = (
        ('IMAGE', 'Image'),
        ('VIDEO', 'Video'),
        ('AUDIO', 'Audio / Voice Note'),
        ('DOCUMENT', 'Document / PDF'),
    )
    file = models.FileField(upload_to='chat_media/')
    file_type = models.CharField(max_length=15, choices=FILE_TYPES, default='IMAGE')
    file_size = models.IntegerField(default=0)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='uploaded_files')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Media {self.id} ({self.file_type}) uploaded by {self.uploaded_by.username}"
