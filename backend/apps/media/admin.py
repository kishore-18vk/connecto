from django.contrib import admin
from .models import MediaFile

class MediaFileAdmin(admin.ModelAdmin):
    list_display = ('id', 'file_type', 'file_size', 'uploaded_by', 'created_at')
    list_filter = ('file_type', 'created_at')
    search_fields = ('uploaded_by__username', 'file')

admin.site.register(MediaFile, MediaFileAdmin)
