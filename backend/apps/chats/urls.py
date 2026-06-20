from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ChatViewSet, MessageViewSet

router = DefaultRouter()
router.register('messages', MessageViewSet, basename='message')
router.register('', ChatViewSet, basename='chat')

urlpatterns = [
    path('', include(router.urls)),
]
