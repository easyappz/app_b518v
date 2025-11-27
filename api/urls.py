from django.urls import path
from .views import (
    HelloView,
    TelegramAuthView,
    LogoutView,
    CurrentUserView,
    UserDetailView,
    UserUpdateView,
    UserStatsView,
    RegisterWithReferralView,
    UserReferralsView,
    ReferralTreeView,
    ReferralLinkView
)

urlpatterns = [
    path('hello/', HelloView.as_view(), name='hello'),
    
    # Authentication
    path('auth/telegram', TelegramAuthView.as_view(), name='telegram-auth'),
    path('auth/logout', LogoutView.as_view(), name='logout'),
    path('auth/me', CurrentUserView.as_view(), name='current-user'),
    
    # User management
    path('users/<int:user_id>', UserDetailView.as_view(), name='user-detail'),
    path('users/<int:user_id>', UserUpdateView.as_view(), name='user-update'),
    path('users/<int:user_id>/stats', UserStatsView.as_view(), name='user-stats'),
    
    # Referral system
    path('user/register', RegisterWithReferralView.as_view(), name='register-with-referral'),
    path('user/<int:user_id>/referrals', UserReferralsView.as_view(), name='user-referrals'),
    path('user/<int:user_id>/referral-tree', ReferralTreeView.as_view(), name='referral-tree'),
    path('referral/link/<int:user_id>', ReferralLinkView.as_view(), name='referral-link'),
]
