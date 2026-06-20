from django.contrib import admin
from .models import Status, StatusView

class StatusAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'media_type', 'background_color', 'created_at')
    list_filter = ('media_type', 'created_at')
    search_fields = ('user__username', 'text_content')

class StatusViewAdmin(admin.ModelAdmin):
    list_display = ('id', 'status', 'user', 'viewed_at')
    list_filter = ('viewed_at',)
    search_fields = ('user__username', 'status__id')

admin.site.register(Status, StatusAdmin)
admin.site.register(StatusView, StatusViewAdmin)
