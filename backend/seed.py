import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.tenants.models import Organisation
from apps.auth_ext.models import User

def seed():
    print("Seeding database...")
    
    # 1. Create Organisation
    org, created = Organisation.objects.get_or_create(
        slug="breathe-esg",
        defaults={
            "name": "Breathe ESG Corp",
            "plan": "enterprise",
            "is_active": True
        }
    )
    if created:
        print(f"Created Organisation: {org.name}")
    else:
        print(f"Organisation {org.name} already exists.")
        
    # 2. Create Users
    users_to_create = [
        {
            "username": "admin",
            "email": "admin@breatheesg.com",
            "first_name": "Admin",
            "last_name": "User",
            "role": User.Role.ADMIN,
            "password": "password123"
        },
        {
            "username": "analyst",
            "email": "analyst@breatheesg.com",
            "first_name": "Analyst",
            "last_name": "User",
            "role": User.Role.ANALYST,
            "password": "password123"
        },
        {
            "username": "viewer",
            "email": "viewer@breatheesg.com",
            "first_name": "Viewer",
            "last_name": "User",
            "role": User.Role.VIEWER,
            "password": "password123"
        }
    ]
    
    for u_info in users_to_create:
        user, u_created = User.objects.get_or_create(
            username=u_info["username"],
            defaults={
                "email": u_info["email"],
                "first_name": u_info["first_name"],
                "last_name": u_info["last_name"],
                "role": u_info["role"],
                "organisation": org,
                "is_active": True
            }
        )
        if u_created:
            user.set_password(u_info["password"])
            user.save()
            print(f"Created User: {user.username} ({user.role})")
        else:
            print(f"User {user.username} already exists.")

if __name__ == "__main__":
    seed()
