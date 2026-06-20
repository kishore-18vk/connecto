from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from apps.authentication.views import EmailRegisterView, EmailLoginView, LogoutView
from apps.accounts.views import ProfileView, ProfileUpdateView, UserSearchView, BlockUserView, UnblockUserView
from apps.chats.views import (
    ChatListView, ChatDetailView, SendMessageView, DeleteChatView, UnreadCountView,
    SendMessageAPIView, ChatMessagesAPIView
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.authentication.urls')),
    path('api/profiles/', include('apps.accounts.urls')), # profiles are in accounts
    path('api/accounts/', include('apps.accounts.urls')), # allow both profiles and accounts mappings
    path('api/contacts/', include('apps.contacts.urls')),
    path('api/chats/', include('apps.chats.urls')),
    path('api/groups/', include('apps.groups.urls')),
    path('api/status/', include('apps.status.urls')),
    path('api/notifications/', include('apps.notifications.urls')),
    path('api/calls/', include('apps.calls.urls')),
    path('api/media/', include('apps.media.urls')),

    # Required exact APIs
    path('api/register', EmailRegisterView.as_view(), name='api-register'),
    path('api/login', EmailLoginView.as_view(), name='api-login'),
    path('api/logout', LogoutView.as_view(), name='api-logout'),
    path('api/profile', ProfileView.as_view(), name='api-profile'),
    path('api/profile/update', ProfileUpdateView.as_view(), name='api-profile-update'),
    path('api/users/search', UserSearchView.as_view(), name='api-user-search'),
    path('api/chats', ChatListView.as_view(), name='api-chats'),
    path('api/chat/<int:chat_id>', ChatDetailView.as_view(), name='api-chat-detail'),
    path('api/chat/send', SendMessageView.as_view(), name='api-chat-send'),
    path('api/chat/delete', DeleteChatView.as_view(), name='api-chat-delete'),
    path('api/block-user', BlockUserView.as_view(), name='api-block-user'),
    path('api/unblock-user', UnblockUserView.as_view(), name='api-unblock-user'),
    path('api/unread-count', UnreadCountView.as_view(), name='api-unread-count'),
    
    # Newly added prompt-compliant routes
    path('api/messages/send', SendMessageAPIView.as_view(), name='api-messages-send'),
    path('api/chats/<int:chat_id>/messages', ChatMessagesAPIView.as_view(), name='api-chat-messages'),
    path('api/chats/<int:chat_id>/messages/', ChatMessagesAPIView.as_view(), name='api-chat-messages-slash'),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
