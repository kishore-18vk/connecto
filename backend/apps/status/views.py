from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from django.utils import timezone
from datetime import timedelta
from django.db.models import Q
from .models import Status, StatusView
from .serializers import StatusSerializer
from apps.contacts.models import Contact

class StatusViewSet(viewsets.ModelViewSet):
    serializer_class = StatusSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        time_threshold = timezone.now() - timedelta(hours=24)
        contact_ids = Contact.objects.filter(user=self.request.user).values_list('contact_id', flat=True)
        return Status.objects.filter(
            Q(user__in=contact_ids) | Q(user=self.request.user),
            created_at__gte=time_threshold
        ).order_by('-created_at')

    def perform_create(self, serializer):
        media_type = self.request.data.get('media_type', 'TEXT')
        if media_type == 'TEXT':
            text_content = self.request.data.get('text_content')
            if not text_content:
                raise ValidationError("text_content is required for TEXT status.")
        else:
            if 'media_file' not in self.request.FILES:
                raise ValidationError("media_file is required for IMAGE/VIDEO status.")

        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def view(self, request, pk=None):
        status_obj = self.get_object()
        if status_obj.user == request.user:
            return Response({"detail": "Cannot mark own status as viewed."}, status=status.HTTP_400_BAD_REQUEST)
        
        StatusView.objects.get_or_create(status=status_obj, user=request.user)
        return Response({"status": "viewed"})

    @action(detail=False, methods=['get'])
    def my_statuses(self, request):
        time_threshold = timezone.now() - timedelta(hours=24)
        my_statuses = Status.objects.filter(user=request.user, created_at__gte=time_threshold).order_by('-created_at')
        serializer = self.get_serializer(my_statuses, many=True)
        return Response(serializer.data)
