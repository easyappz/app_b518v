from django.urls import path
from .views import (
    HelloView,
    TelegramAuthView,
    LogoutView,
    CurrentUserView,
    UserDetailView,
    UserUpdateView,
    UserStatsView
)

urlpatterns = [
    path("hello/", HelloView.as_view(), name="hello"),
    
    # Authentication endpoints
    path("auth/telegram", TelegramAuthView.as_view(), name="telegram-auth"),
    path("auth/logout", LogoutView.as_view(), name="logout"),
    path("auth/me", CurrentUserView.as_view(), name="current-user"),
    
    # User endpoints
    path("users/<int:user_id>", UserDetailView.as_view(), name="user-detail"),
    path("users/<int:user_id>", UserUpdateView.as_view(), name="user-update"),
    path("users/<int:user_id>/stats", UserStatsView.as_view(), name="user-stats"),
]
