"""
Sample user API endpoints.

Following Dalgo backend best practices for API structure.
"""

from django.contrib.auth.models import User

from ninja import Router

from sessionops.utils.custom_logger import CustomLogger

logger = CustomLogger("sessionops.api.users")

user_router = Router()


@user_router.get("/")
def list_users(request):
    """
    List all users.

    This is a sample endpoint demonstrating the API structure.
    """
    logger.info("Listing users")
    users = User.objects.all()
    return {
        "users": [
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
            }
            for user in users
        ]
    }


@user_router.get("/{user_id}")
def get_user(request, user_id: int):
    """
    Get a specific user by ID.

    Args:
        user_id: The ID of the user to retrieve
    """
    logger.info(f"Getting user {user_id}")
    try:
        user = User.objects.get(id=user_id)
        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
        }
    except User.DoesNotExist:
        return {"error": "User not found"}, 404
