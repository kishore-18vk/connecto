from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ContactViewSet, FavoriteContactsView, SuggestedContactsView

router = DefaultRouter()
router.register('', ContactViewSet, basename='contact')

urlpatterns = [
    path('favorites/', FavoriteContactsView.as_view(), name='contact-favorites'),
    path('suggested/', SuggestedContactsView.as_view(), name='contact-suggested'),
    path('', include(router.urls)),
]
