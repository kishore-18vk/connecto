from celery import shared_task
from django.utils import timezone
from datetime import timedelta
import os
from .models import Status

@shared_task
def expire_status_updates():
    limit_time = timezone.now() - timedelta(hours=24)
    expired_statuses = Status.objects.filter(created_at__lt=limit_time)
    count = expired_statuses.count()
    
    for status in expired_statuses:
        if status.media_file:
            try:
                if os.path.exists(status.media_file.path):
                    os.remove(status.media_file.path)
            except Exception as e:
                print(f"Error removing expired status file: {e}")
                
    expired_statuses.delete()
    return f"Cleaned up {count} expired statuses."
