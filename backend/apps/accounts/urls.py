from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SelfProfileView, UserSearchView, BlockedUserViewSet

router = DefaultRouter()
router.register('blocked', BlockedUserViewSet, basename='blocked')

urlpatterns = [
    path('me/', SelfProfileView.as_view(), name='profile-me'),
    path('profile/', SelfProfileView.as_view(), name='profile-update'),
    path('search/', UserSearchView.as_view(), name='user-search'),
    path('', include(router.urls)),
]
