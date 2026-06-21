import os
import requests
import uuid
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.conf import settings
from django.core.validators import validate_email
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.utils import timezone
from datetime import timedelta
import random
from .models import EmailOTP

User = get_user_model()

def generate_unique_username(email):
    base = email.split('@')[0]
    base = "".join(c for c in base if c.isalnum() or c in ('_', '-'))
    if not base:
        base = "user"
    username = base
    suffix = 1
    while User.objects.filter(username=username).exists():
        username = f"{base}_{suffix}"
        suffix += 1
    return username

class GoogleLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get('token')
        is_mock = request.data.get('is_mock', False)

        # 1. Mock Authentication Mode
        if is_mock or not token:
            email = request.data.get('email', 'mockuser@example.com')
            name = request.data.get('name', 'Mock User')
            avatar_url = request.data.get('avatar_url', f"https://api.dicebear.com/7.x/adventurer/svg?seed={email}")
            google_id = request.data.get('google_id', f"mock_google_id_{email.split('@')[0]}")
            
            user = User.objects.filter(email=email).first()
            created = False
            if not user:
                user = User.objects.create(
                    email=email,
                    username=generate_unique_username(email),
                    google_id=google_id,
                    nickname=name,
                    avatar_url=avatar_url
                )
                user.set_password(User.objects.make_random_password())
                user.save()
                created = True
            
            refresh = RefreshToken.for_user(user)
            return Response({
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'google_id': user.google_id,
                    'nickname': user.nickname,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'avatar_url': user.avatar_url
                },
                'created': created
            }, status=status.HTTP_200_OK)

        # 2. Verify Google Token
        try:
            google_url = f"https://oauth2.googleapis.com/tokeninfo?id_token={token}"
            response = requests.get(google_url)
            if response.status_code != 200:
                return Response({"detail": "Invalid Google Token"}, status=status.HTTP_400_BAD_REQUEST)
                
            id_info = response.json()
            aud = id_info.get('aud')
            
            if settings.GOOGLE_CLIENT_ID and aud != settings.GOOGLE_CLIENT_ID:
                return Response({"detail": "Token audience mismatch"}, status=status.HTTP_400_BAD_REQUEST)

            email = id_info.get('email')
            name = id_info.get('name', '')
            picture = id_info.get('picture', '')
            google_id = id_info.get('sub')

            if not email:
                return Response({"detail": "Email not provided by Google"}, status=status.HTTP_400_BAD_REQUEST)

            user = User.objects.filter(email=email).first()
            created = False
            if not user:
                user = User.objects.create(
                    email=email,
                    username=generate_unique_username(email),
                    google_id=google_id,
                    nickname=name,
                    avatar_url=picture
                )
                user.set_password(User.objects.make_random_password())
                user.save()
                created = True
            else:
                if google_id and not user.google_id:
                    user.google_id = google_id
                if picture and not user.avatar_url:
                    user.avatar_url = picture
                user.save()

            refresh = RefreshToken.for_user(user)
            return Response({
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'google_id': user.google_id,
                    'nickname': user.nickname,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'avatar_url': user.avatar_url
                },
                'created': created
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

from apps.accounts.models import ActiveSession

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Clear active session
        ActiveSession.objects.filter(user=request.user).delete()
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            return Response({"detail": "Successfully logged out from current device."}, status=status.HTTP_200_OK)
        except Exception:
            return Response({"detail": "Successfully logged out from current device."}, status=status.HTTP_200_OK)

class LogoutAllView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        ActiveSession.objects.filter(user=user).delete()
        user.password = make_password(uuid.uuid4().hex)
        user.save()
        return Response({"detail": "Successfully logged out from all devices."}, status=status.HTTP_200_OK)

class EmailRegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        username = request.data.get('username')
        nickname = request.data.get('nickname')
        password = request.data.get('password')
        confirm_password = request.data.get('confirm_password')
        otp = request.data.get('otp')

        if not email or not password or not otp:
            return Response({"detail": "Email, password, and OTP are required."}, status=status.HTTP_400_BAD_REQUEST)

        if confirm_password and password != confirm_password:
            return Response({"detail": "Confirm password does not match password."}, status=status.HTTP_400_BAD_REQUEST)

        # Verify OTP
        otp_record = EmailOTP.objects.filter(email=email).order_by('-created_at').first()
        if not otp_record:
            return Response({"detail": "No OTP found for this email. Please request a new one."}, status=status.HTTP_400_BAD_REQUEST)

        if otp_record.is_expired():
            return Response({"detail": "Verification code has expired. Please request a new code."}, status=status.HTTP_400_BAD_REQUEST)

        if otp_record.otp != otp:
            otp_record.attempt_count += 1
            otp_record.save()
            remaining = 5 - otp_record.attempt_count
            if remaining <= 0:
                return Response({"detail": "Maximum OTP verification attempts exceeded (5). Please request a new code."}, status=status.HTTP_400_BAD_REQUEST)
            return Response({"detail": f"Invalid verification code. {remaining} attempts remaining."}, status=status.HTTP_400_BAD_REQUEST)

        if not username:
            username = generate_unique_username(email)

        if not nickname:
            nickname = username

        if User.objects.filter(email=email).exists():
            return Response({"detail": "Account already exists. Please login."}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(username=username).exists():
            return Response({"detail": "Username already exists."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            avatar_url = f"https://api.dicebear.com/7.x/adventurer/svg?seed={email}"
            
            user = User.objects.create(
                email=email,
                username=username,
                nickname=nickname,
                avatar_url=avatar_url,
                is_email_verified=True
            )
            user.set_password(password)
            user.save()

            # Delete OTP record
            otp_record.delete()

            refresh = RefreshToken.for_user(user)
            device_info = request.META.get('HTTP_USER_AGENT', 'Unknown Device')
            ActiveSession.objects.create(user=user, jwt_token=str(refresh), device_info=device_info)

            return Response({
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'google_id': user.google_id,
                    'nickname': user.nickname,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'avatar_url': user.avatar_url
                },
                'created': True
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class SendOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_email(email)
        except DjangoValidationError:
            return Response({"detail": "Invalid email format."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            otp_code = f"{random.randint(100000, 999999)}"
            expires_at = timezone.now() + timedelta(minutes=5)
            
            # Update or create OTP
            EmailOTP.objects.update_or_create(
                email=email,
                defaults={'otp': otp_code, 'expires_at': expires_at, 'attempt_count': 0}
            )

            # Send OTP using Resend API
            api_key = os.environ.get('RESEND_API_KEY', 're_9Bna4kjq_AbAV8N2K3gynqDLWuG9FWeFQ')
            url = "https://api.resend.com/emails"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "from": "onboarding@resend.dev",
                "to": email,
                "subject": "Your Login OTP",
                "html": f"<p>Your OTP is: <strong>{otp_code}</strong></p><p>This OTP will expire in 5 minutes.</p>"
            }
            
            try:
                res = requests.post(url, headers=headers, json=payload)
                if res.status_code not in (200, 201):
                    print(f"Resend API Error: {res.status_code} - {res.text}")
                    # Fallback to local console log in case of API Key restrictions
            except Exception as e:
                print(f"Resend API Exception: {e}")

            return Response({
                "detail": f"Verification code sent to {email}."
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class VerifyOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        otp = request.data.get('otp')

        if not email or not otp:
            return Response({"detail": "Email and OTP are required."}, status=status.HTTP_400_BAD_REQUEST)

        otp_record = EmailOTP.objects.filter(email=email).order_by('-created_at').first()
        if not otp_record:
            return Response({"detail": "No OTP found for this email. Please request a new one."}, status=status.HTTP_400_BAD_REQUEST)

        if otp_record.is_expired():
            return Response({"detail": "Verification code has expired. Please request a new code."}, status=status.HTTP_400_BAD_REQUEST)

        if otp_record.otp != otp:
            otp_record.attempt_count += 1
            otp_record.save()
            remaining = 5 - otp_record.attempt_count
            if remaining <= 0:
                return Response({"detail": "Maximum OTP verification attempts exceeded (5). Please request a new code."}, status=status.HTTP_400_BAD_REQUEST)
            return Response({"detail": f"Invalid verification code. {remaining} attempts remaining."}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"detail": "OTP verified successfully. You can now set your password."}, status=status.HTTP_200_OK)


class EmailLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        logout_previous = request.data.get('logout_previous', False)

        if not email or not password:
            return Response({"detail": "Email and password are required."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email=email).first()
        if not user or not user.check_password(password):
            return Response({"detail": "Invalid email or password."}, status=status.HTTP_401_UNAUTHORIZED)

        # Enforce single session login (Disabled to allow login on any device)
        # active_session = ActiveSession.objects.filter(user=user).first()
        # if active_session:
        #     if not logout_previous:
        #         return Response({
        #             "detail": "This account is already active on another device.",
        #             "session_conflict": True
        #         }, status=status.HTTP_400_BAD_REQUEST)
        #     else:
        #         ActiveSession.objects.filter(user=user).delete()

        refresh = RefreshToken.for_user(user)
        device_info = request.META.get('HTTP_USER_AGENT', 'Unknown Device')
        ActiveSession.objects.create(user=user, jwt_token=str(refresh), device_info=device_info)

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'google_id': user.google_id,
                'nickname': user.nickname,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'avatar_url': user.avatar_url
            }
        }, status=status.HTTP_200_OK)
