from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    email = models.EmailField(unique=True)
    google_id = models.CharField(max_length=255, unique=True, null=True, blank=True)
    nickname = models.CharField(max_length=255, blank=True)
    is_online = models.BooleanField(default=False)
    last_seen = models.DateTimeField(null=True, blank=True)
    avatar_url = models.URLField(max_length=500, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    REQUIRED_FIELDS = ['email']

    def __str__(self):
        return self.username

class UserProfile(models.Model):
    PRIVACY_CHOICES = (
        ('EVERYONE', 'Everyone'),
        ('CONTACTS', 'Contacts Only'),
        ('NOBODY', 'Nobody'),
    )
    EMAIL_PRIVACY_CHOICES = (
        ('PUBLIC', 'Public'),
        ('FRIENDS', 'Friends Only'),
        ('PRIVATE', 'Private'),
    )
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    bio = models.TextField(max_length=500, default="Hey there! I am using WhatsApp.")
    profile_picture = models.ImageField(upload_to='profiles/', null=True, blank=True)
    privacy_last_seen = models.CharField(max_length=10, choices=PRIVACY_CHOICES, default='EVERYONE')
    privacy_profile_picture = models.CharField(max_length=10, choices=PRIVACY_CHOICES, default='EVERYONE')
    privacy_status = models.CharField(max_length=10, choices=PRIVACY_CHOICES, default='EVERYONE')
    privacy_email = models.CharField(max_length=10, choices=EMAIL_PRIVACY_CHOICES, default='PRIVATE')
    date_joined = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username}'s profile"

class BlockedUser(models.Model):
    blocker = models.ForeignKey(User, on_delete=models.CASCADE, related_name='blocked_by_user')
    blocked = models.ForeignKey(User, on_delete=models.CASCADE, related_name='blocked_users')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('blocker', 'blocked')

    def __str__(self):
        return f"{self.blocker.username} blocked {self.blocked.username}"

class ActiveSession(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='active_sessions')
    jwt_token = models.TextField()
    device_info = models.CharField(max_length=255, default='Unknown Device')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.device_info}"

