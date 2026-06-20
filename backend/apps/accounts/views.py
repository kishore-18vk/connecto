from rest_framework import generics, viewsets, status, filters
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from rest_framework.decorators import action
from .models import User, UserProfile, BlockedUser
from .serializers import UserSerializer, BlockedUserSerializer

class SelfProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        user_data = request.data
        
        if 'first_name' in user_data:
            user.first_name = user_data['first_name']
        if 'last_name' in user_data:
            user.last_name = user_data['last_name']
        if 'nickname' in user_data:
            user.nickname = user_data['nickname']
        if 'username' in user_data:
            new_username = user_data['username']
            if User.objects.exclude(id=user.id).filter(username=new_username).exists():
                return Response({"detail": "Username already taken"}, status=status.HTTP_400_BAD_REQUEST)
            user.username = new_username
        user.save()

        profile = user.profile
        bio = user_data.get('bio')
        privacy_last_seen = user_data.get('privacy_last_seen')
        privacy_profile_picture = user_data.get('privacy_profile_picture')
        privacy_status = user_data.get('privacy_status')
        privacy_email = user_data.get('privacy_email')

        if bio is not None:
            profile.bio = bio
        if privacy_last_seen is not None:
            profile.privacy_last_seen = privacy_last_seen
        if privacy_profile_picture is not None:
            profile.privacy_profile_picture = privacy_profile_picture
        if privacy_status is not None:
            profile.privacy_status = privacy_status
        if privacy_email is not None:
            profile.privacy_email = privacy_email
            
        if 'profile_picture' in request.FILES:
            profile.profile_picture = request.FILES['profile_picture']
            
        profile.save()
        
        serializer = self.get_serializer(user)
        return Response(serializer.data)

from django.db.models import Q
from rest_framework.views import APIView

class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        profile_picture = request.build_absolute_uri(user.profile.profile_picture.url) if hasattr(user, 'profile') and user.profile.profile_picture else user.avatar_url
        bio = user.profile.bio if hasattr(user, 'profile') else ""
        return Response({
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "profile_picture": profile_picture,
            "bio": bio,
            "created_at": user.created_at
        }, status=status.HTTP_200_OK)

class ProfileUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request):
        user = request.user
        username = request.data.get('username')
        bio = request.data.get('bio')
        profile_picture_file = request.FILES.get('profile_picture')

        if username:
            if User.objects.exclude(id=user.id).filter(username=username).exists():
                return Response({"detail": "Username already taken"}, status=status.HTTP_400_BAD_REQUEST)
            user.username = username
            user.save()

        profile = user.profile
        if bio is not None:
            profile.bio = bio
        if profile_picture_file:
            profile.profile_picture = profile_picture_file
        profile.save()

        profile_pic_url = request.build_absolute_uri(profile.profile_picture.url) if profile.profile_picture else user.avatar_url
        return Response({
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "profile_picture": profile_pic_url,
            "bio": profile.bio,
            "created_at": user.created_at
        }, status=status.HTTP_200_OK)

class UserSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response([], status=status.HTTP_200_OK)

        users = User.objects.filter(
            Q(username__icontains=query) | Q(email__icontains=query)
        ).exclude(id=request.user.id)

        results = []
        for user in users:
            profile_picture = request.build_absolute_uri(user.profile.profile_picture.url) if hasattr(user, 'profile') and user.profile.profile_picture else user.avatar_url
            bio = user.profile.bio if hasattr(user, 'profile') else ""
            results.append({
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "profile_picture": profile_picture,
                "bio": bio
            })
        return Response(results, status=status.HTTP_200_OK)

class BlockUserView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        blocked_user_id = request.data.get('blocked_user_id') or request.data.get('blocked')
        if not blocked_user_id:
            return Response({"detail": "blocked_user_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        if int(blocked_user_id) == request.user.id:
            return Response({"detail": "You cannot block yourself."}, status=status.HTTP_400_BAD_REQUEST)

        blocked_user = User.objects.filter(id=blocked_user_id).first()
        if not blocked_user:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        BlockedUser.objects.get_or_create(blocker=request.user, blocked=blocked_user)
        return Response({"detail": "User blocked successfully"}, status=status.HTTP_200_OK)

class UnblockUserView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        blocked_user_id = request.data.get('blocked_user_id') or request.data.get('user_id')
        if not blocked_user_id:
            return Response({"detail": "blocked_user_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        BlockedUser.objects.filter(blocker=request.user, blocked_id=blocked_user_id).delete()
        return Response({"detail": "User unblocked successfully"}, status=status.HTTP_200_OK)

class BlockedUserViewSet(viewsets.ModelViewSet):
    serializer_class = BlockedUserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return BlockedUser.objects.filter(blocker=self.request.user)

    def perform_create(self, serializer):
        blocked_user_id = self.request.data.get('blocked')
        if not blocked_user_id:
            raise ValidationError({"blocked": "This field is required."})
        if int(blocked_user_id) == self.request.user.id:
            raise ValidationError("You cannot block yourself.")
        if BlockedUser.objects.filter(blocker=self.request.user, blocked_id=blocked_user_id).exists():
            raise ValidationError("User is already blocked.")
        serializer.save(blocker=self.request.user)

    @action(detail=False, methods=['post'])
    def unblock(self, request):
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({"detail": "user_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        BlockedUser.objects.filter(blocker=request.user, blocked_id=user_id).delete()
        return Response({"detail": "User unblocked successfully"}, status=status.HTTP_200_OK)
