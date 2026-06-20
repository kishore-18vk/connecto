from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CallHistoryViewSet

router = DefaultRouter()
router.register('', CallHistoryViewSet, basename='call')

urlpatterns = [
    path('', include(router.urls)),
]
