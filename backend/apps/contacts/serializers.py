from rest_framework import serializers
from .models import Contact
from apps.accounts.serializers import UserSerializer

class ContactSerializer(serializers.ModelSerializer):
    contact_details = UserSerializer(source='contact', read_only=True)

    class Meta:
        model = Contact
        fields = ['id', 'contact', 'contact_details', 'is_favorite', 'created_at']
        read_only_fields = ['id', 'created_at']
