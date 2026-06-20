from django.db import models
from django.conf import settings

class Chat(models.Model):
    CHAT_TYPES = (
        ('DM', 'Direct Message'),
        ('GROUP', 'Group Chat'),
    )
    type = models.CharField(max_length=10, choices=CHAT_TYPES, default='DM')
    participants = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='chats')
    deleted_by = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='deleted_chats', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Chat {self.id} ({self.type})"

class Message(models.Model):
    MESSAGE_TYPES = (
        ('TEXT', 'Text Message'),
        ('IMAGE', 'Image'),
        ('VIDEO', 'Video'),
        ('AUDIO', 'Audio'),
        ('VOICE_NOTE', 'Voice Note'),
        ('DOCUMENT', 'Document / PDF'),
        ('GIF', 'GIF'),
        ('STICKER', 'Sticker'),
    )
    chat = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_messages')
    receiver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='received_messages')
    content = models.TextField(blank=True, null=True)
    is_seen = models.BooleanField(default=False)
    message_type = models.CharField(max_length=15, choices=MESSAGE_TYPES, default='TEXT')
    media_url = models.URLField(max_length=500, blank=True, null=True)
    parent_message = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='replies')
    is_pinned = models.BooleanField(default=False)
    is_deleted_for_everyone = models.BooleanField(default=False)
    deleted_by = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='deleted_messages', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def message(self):
        return self.content

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new and self.chat.type == 'DM':
            other_user = self.chat.participants.exclude(id=self.sender.id).first()
            if other_user:
                self.receiver = other_user
                super().save(update_fields=['receiver'])

    def __str__(self):
        return f"Message {self.id} by {self.sender.username} in Chat {self.chat.id}"

class StarredMessage(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='starred_messages')
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='starred_by')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'message')

class MessageStatus(models.Model):
    STATUS_CHOICES = (
        ('SENT', 'Sent'),
        ('DELIVERED', 'Delivered'),
        ('READ', 'Read'),
    )
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='statuses')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='message_delivery_statuses')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='SENT')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('message', 'user')

class MessageReaction(models.Model):
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='reactions')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='message_reactions')
    emoji = models.CharField(max_length=10)

    class Meta:
        unique_together = ('message', 'user')
