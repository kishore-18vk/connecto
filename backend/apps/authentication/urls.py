from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import GoogleLoginView, LogoutView, LogoutAllView, EmailRegisterView, EmailLoginView

urlpatterns = [
    path('google/', GoogleLoginView.as_view(), name='google-login'),
    path('register/', EmailRegisterView.as_view(), name='email-register'),
    path('login/', EmailLoginView.as_view(), name='email-login'),
    path('refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('logout/', LogoutView.as_view(), name='logout-device'),
    path('logout/all/', LogoutAllView.as_view(), name='logout-all'),
]
