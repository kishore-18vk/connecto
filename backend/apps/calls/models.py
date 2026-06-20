from django.db import models
from django.conf import settings
from apps.groups.models import Group

class CallHistory(models.Model):
    CALL_TYPES = (
        ('VOICE', 'Voice Call'),
        ('VIDEO', 'Video Call'),
    )
    CALL_STATUSES = (
        ('MISSED', 'Missed'),
        ('COMPLETED', 'Completed'),
        ('REJECTED', 'Rejected'),
        ('BUSY', 'Busy'),
    )
    caller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='outgoing_calls')
    receiver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='incoming_calls', null=True, blank=True)
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='group_calls', null=True, blank=True)
    type = models.CharField(max_length=10, choices=CALL_TYPES, default='VOICE')
    status = models.CharField(max_length=15, choices=CALL_STATUSES, default='COMPLETED')
    duration = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Call {self.id} from {self.caller.username} - {self.status}"
