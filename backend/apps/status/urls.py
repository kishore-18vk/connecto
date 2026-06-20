from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import StatusViewSet

router = DefaultRouter()
router.register('', StatusViewSet, basename='status')

urlpatterns = [
    path('', include(router.urls)),
]
