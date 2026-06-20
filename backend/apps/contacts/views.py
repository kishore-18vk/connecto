from rest_framework import viewsets, generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from .models import Contact
from .serializers import ContactSerializer
from apps.accounts.models import User
from apps.accounts.serializers import UserSerializer

class ContactViewSet(viewsets.ModelViewSet):
    serializer_class = ContactSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Contact.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        contact_id = self.request.data.get('contact')
        if not contact_id:
            raise ValidationError({"contact": "This field is required."})
        if int(contact_id) == self.request.user.id:
            raise ValidationError("You cannot add yourself as a contact.")
        if Contact.objects.filter(user=self.request.user, contact_id=contact_id).exists():
            raise ValidationError("User is already in your contacts.")
        serializer.save(user=self.request.user)

class FavoriteContactsView(generics.ListAPIView):
    serializer_class = ContactSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Contact.objects.filter(user=self.request.user, is_favorite=True)

class SuggestedContactsView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        contact_ids = Contact.objects.filter(user=self.request.user).values_list('contact_id', flat=True)
        return User.objects.exclude(id=self.request.user.id).exclude(id__in=contact_ids)[:10]
