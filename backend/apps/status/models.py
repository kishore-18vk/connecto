from django.db import models
from django.conf import settings

class Status(models.Model):
    MEDIA_TYPES = (
        ('TEXT', 'Text Status'),
        ('IMAGE', 'Image'),
        ('VIDEO', 'Video'),
    )
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='statuses')
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPES, default='TEXT')
    media_file = models.FileField(upload_to='status/', blank=True, null=True)
    text_content = models.TextField(blank=True, null=True)
    background_color = models.CharField(max_length=20, default='#128c7e', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username}'s Status ({self.media_type}) at {self.created_at}"

class StatusView(models.Model):
    status = models.ForeignKey(Status, on_delete=models.CASCADE, related_name='views')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='status_views')
    viewed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('status', 'user')

    def __str__(self):
        return f"{self.user.username} viewed status {self.status.id}"
