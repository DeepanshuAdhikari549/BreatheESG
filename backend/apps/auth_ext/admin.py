from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ["username", "email", "role", "organisation", "is_active"]
    list_filter = ["role", "is_active", "organisation"]
    fieldsets = BaseUserAdmin.fieldsets + (
        ("ESG Platform", {"fields": ("role", "organisation")}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ("ESG Platform", {"fields": ("role", "organisation")}),
    )
    search_fields = ["username", "email"]
