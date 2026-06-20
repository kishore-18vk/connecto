from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from .models import Group, GroupMember
from .serializers import GroupSerializer
from apps.chats.models import Chat
from apps.accounts.models import User

class GroupViewSet(viewsets.ModelViewSet):
    serializer_class = GroupSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Group.objects.filter(members__user=self.request.user)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        name = request.data.get('name')
        description = request.data.get('description', '')
        members_ids = request.data.getlist('members') if hasattr(request.data, 'getlist') else request.data.get('members', [])

        if not name:
            raise ValidationError({"name": "Group name is required."})

        # Create Chat
        chat = Chat.objects.create(type='GROUP')
        chat.participants.add(request.user)
        for uid in members_ids:
            if User.objects.filter(id=uid).exists():
                chat.participants.add(uid)
        chat.save()

        # Create Group Profile
        profile_picture = request.FILES.get('profile_picture')
        group = Group.objects.create(
            chat=chat,
            name=name,
            description=description,
            created_by=request.user,
            profile_picture=profile_picture
        )

        # Create Group Members
        GroupMember.objects.create(group=group, user=request.user, role='CREATOR')
        for uid in members_ids:
            if int(uid) != request.user.id and User.objects.filter(id=uid).exists():
                GroupMember.objects.create(group=group, user_id=uid, role='MEMBER')

        serializer = self.get_serializer(group)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        group = self.get_object()
        is_admin = GroupMember.objects.filter(group=group, user=self.request.user, role__in=['ADMIN', 'CREATOR']).exists()
        if not is_admin:
            raise PermissionDenied("Only group admins can update group profile.")
        
        # If updating profile picture
        if 'profile_picture' in self.request.FILES:
            group.profile_picture = self.request.FILES['profile_picture']
            group.save()
            
        serializer.save()

    def perform_destroy(self, instance):
        is_creator = GroupMember.objects.filter(group=instance, user=self.request.user, role='CREATOR').exists()
        if not is_creator:
            raise PermissionDenied("Only the group creator can delete this group.")
        
        instance.chat.delete()

    @action(detail=True, methods=['post'])
    def add_members(self, request, pk=None):
        group = self.get_object()
        is_admin = GroupMember.objects.filter(group=group, user=request.user, role__in=['ADMIN', 'CREATOR']).exists()
        if not is_admin:
            raise PermissionDenied("Only admins can add members.")

        user_ids = request.data.get('user_ids', [])
        added_members = []
        for uid in user_ids:
            if not GroupMember.objects.filter(group=group, user_id=uid).exists():
                user = User.objects.filter(id=uid).first()
                if user:
                    GroupMember.objects.create(group=group, user=user, role='MEMBER')
                    group.chat.participants.add(user)
                    added_members.append(user.username)
        
        group.chat.save()
        return Response({"status": "members added", "added": added_members})

    @action(detail=True, methods=['post'])
    def remove_member(self, request, pk=None):
        group = self.get_object()
        user_id = request.data.get('user_id')
        if not user_id:
            raise ValidationError("user_id is required.")

        is_self = int(user_id) == request.user.id
        is_admin = GroupMember.objects.filter(group=group, user=request.user, role__in=['ADMIN', 'CREATOR']).exists()
        
        if not (is_self or is_admin):
            raise PermissionDenied("You do not have permission to remove this member.")

        member = GroupMember.objects.filter(group=group, user_id=user_id).first()
        if not member:
            return Response({"detail": "User is not a member of this group."}, status=status.HTTP_400_BAD_REQUEST)
            
        if member.role == 'CREATOR' and not is_self:
            raise PermissionDenied("Cannot remove the creator of the group.")

        member.delete()
        group.chat.participants.remove(user_id)
        group.chat.save()
        return Response({"status": "member removed"})

    @action(detail=True, methods=['post'])
    def promote_admin(self, request, pk=None):
        group = self.get_object()
        user_id = request.data.get('user_id')
        is_admin = GroupMember.objects.filter(group=group, user=request.user, role__in=['ADMIN', 'CREATOR']).exists()
        if not is_admin:
            raise PermissionDenied("Only admins can promote other members.")

        member = GroupMember.objects.filter(group=group, user_id=user_id).first()
        if not member:
            raise ValidationError("User is not a member of this group.")
        member.role = 'ADMIN'
        member.save()
        return Response({"status": f"{member.user.username} promoted to Admin"})

    @action(detail=True, methods=['post'])
    def demote_admin(self, request, pk=None):
        group = self.get_object()
        user_id = request.data.get('user_id')
        is_creator = GroupMember.objects.filter(group=group, user=request.user, role='CREATOR').exists()
        if not is_creator:
            raise PermissionDenied("Only the group creator can demote admins.")

        member = GroupMember.objects.filter(group=group, user_id=user_id).first()
        if not member:
            raise ValidationError("User is not a member of this group.")
        if member.role == 'CREATOR':
            raise ValidationError("Cannot demote the creator.")
        member.role = 'MEMBER'
        member.save()
        return Response({"status": f"{member.user.username} demoted to Member"})

    @action(detail=False, methods=['post'], url_path='join/(?P<invite_code>[^/.]+)')
    def join_by_invite(self, request, invite_code=None):
        group = Group.objects.filter(invite_code=invite_code).first()
        if not group:
            return Response({"detail": "Group not found or invite code is invalid."}, status=status.HTTP_404_NOT_FOUND)

        if GroupMember.objects.filter(group=group, user=request.user).exists():
            return Response({"status": "already a member", "chat_id": group.chat.id})

        GroupMember.objects.create(group=group, user=request.user, role='MEMBER')
        group.chat.participants.add(request.user)
        group.chat.save()
        return Response({"status": "joined group successfully", "chat_id": group.chat.id, "group_name": group.name})
