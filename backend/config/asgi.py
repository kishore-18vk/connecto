import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Initialize Django ASGI application early to ensure the AppRegistry
# is populated before importing consumers or routing.
django_asgi_app = get_asgi_application()

# Import routing and middleware details from the chat app
# We use lazy imports or imports after django_asgi_app initialization to avoid AppRegistryNotReady error.
from apps.chats.routing import websocket_urlpatterns
from apps.chats.middleware import JWTAuthMiddlewareStack

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": JWTAuthMiddlewareStack(
        URLRouter(
            websocket_urlpatterns
        )
    ),
})
