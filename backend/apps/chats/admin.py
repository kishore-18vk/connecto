from django.contrib import admin
from .models import Chat, Message, StarredMessage, MessageStatus, MessageReaction

class MessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'chat', 'sender', 'message_type', 'is_pinned', 'is_deleted_for_everyone', 'created_at')
    list_filter = ('message_type', 'is_pinned', 'is_deleted_for_everyone', 'created_at')
    search_fields = ('content', 'sender__username', 'chat__id')
    actions = ['moderate_content']

    @admin.action(description='Content Moderation: Redact message content')
    def moderate_content(self, request, queryset):
        queryset.update(content="[This message has been redacted by moderation]")
        self.message_user(request, "Selected message content has been redacted.")

admin.site.register(Chat)
admin.site.register(Message, MessageAdmin)
admin.site.register(StarredMessage)
admin.site.register(MessageStatus)
admin.site.register(MessageReaction)
