from rest_framework import serializers
from .models import CallHistory
from apps.accounts.serializers import UserSerializer

class CallHistorySerializer(serializers.ModelSerializer):
    caller_details = UserSerializer(source='caller', read_only=True)
    receiver_details = UserSerializer(source='receiver', read_only=True)
    group_details = serializers.SerializerMethodField()

    class Meta:
        model = CallHistory
        fields = ['id', 'caller', 'caller_details', 'receiver', 'receiver_details', 'group', 'group_details', 'type', 'status', 'duration', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_group_details(self, obj):
        if obj.group:
            from apps.groups.serializers import GroupSerializer
            return GroupSerializer(obj.group, context=self.context).data
        return None
