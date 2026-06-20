import uuid
from django.db import models
from django.conf import settings
from apps.chats.models import Chat

class Group(models.Model):
    chat = models.OneToOneField(Chat, on_delete=models.CASCADE, related_name='group_profile')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    profile_picture = models.ImageField(upload_to='groups/', blank=True, null=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='created_groups')
    invite_code = models.CharField(max_length=100, unique=True, default=uuid.uuid4)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class GroupMember(models.Model):
    ROLE_CHOICES = (
        ('MEMBER', 'Member'),
        ('ADMIN', 'Admin'),
        ('CREATOR', 'Creator'),
    )
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='group_memberships')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='MEMBER')
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('group', 'user')

    def __str__(self):
        return f"{self.user.username} in {self.group.name} ({self.role})"
