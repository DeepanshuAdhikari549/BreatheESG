from rest_framework.permissions import BasePermission


class IsAdminUser(BasePermission):
    """Allow access only to users with admin role."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == "admin"
        )


class IsAnalystOrAdmin(BasePermission):
    """Allow access to analyst or admin roles."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in ("admin", "analyst")
        )
