from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from .models import CallHistory
from .serializers import CallHistorySerializer

class CallHistoryViewSet(viewsets.ModelViewSet):
    serializer_class = CallHistorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return CallHistory.objects.filter(
            Q(caller=self.request.user) | Q(receiver=self.request.user)
        ).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(caller=self.request.user)
