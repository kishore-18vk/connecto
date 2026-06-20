from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, UserProfile, BlockedUser

class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'first_name', 'last_name', 'is_online', 'last_seen', 'is_staff')
    list_filter = ('is_online', 'is_staff', 'is_superuser')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    actions = ['block_user_accounts', 'unblock_user_accounts']

    @admin.action(description='Deactivate / Block selected users')
    def block_user_accounts(self, request, queryset):
        queryset.update(is_active=False)
        self.message_user(request, "Selected user accounts have been deactivated.")

    @admin.action(description='Activate / Unblock selected users')
    def unblock_user_accounts(self, request, queryset):
        queryset.update(is_active=True)
        self.message_user(request, "Selected user accounts have been activated.")

admin.site.register(User, CustomUserAdmin)
admin.site.register(UserProfile)
admin.site.register(BlockedUser)
