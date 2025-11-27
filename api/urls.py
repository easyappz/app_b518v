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
    ReferralLinkView,
    TransactionListView,
    FirstTournamentCompletedView,
    DepositProcessedView,
    WithdrawalCreateView,
    WithdrawalListView,
    WithdrawalDetailView,
    NotificationListView,
    NotificationReadView,
    PushSubscribeView,
    AdminUserListView,
    AdminUserDetailView,
    AdminUserUpdateView,
    AdminTransactionListView,
    AdminWithdrawalListView,
    AdminWithdrawalUpdateView,
    AdminStatsView,
    AdminAnalyticsView,
)

urlpatterns = [
    path('hello/', HelloView.as_view(), name='hello'),
    
    # Authentication
    path('auth/telegram', TelegramAuthView.as_view(), name='telegram-auth'),
    path('auth/logout', LogoutView.as_view(), name='logout'),
    path('auth/me', CurrentUserView.as_view(), name='current-user'),
    
    # User management
    path('user/register', RegisterWithReferralView.as_view(), name='user-register'),
    path('users/<int:user_id>', UserDetailView.as_view(), name='user-detail'),
    path('users/<int:user_id>', UserUpdateView.as_view(), name='user-update'),
    path('users/<int:user_id>/stats', UserStatsView.as_view(), name='user-stats'),
    
    # Referrals
    path('user/<int:user_id>/referrals', UserReferralsView.as_view(), name='user-referrals'),
    path('user/<int:user_id>/referral-tree', ReferralTreeView.as_view(), name='referral-tree'),
    path('referral/link/<int:user_id>', ReferralLinkView.as_view(), name='referral-link'),
    
    # Transactions
    path('transactions', TransactionListView.as_view(), name='transaction-list'),
    path('tournament/first-completed', FirstTournamentCompletedView.as_view(), name='first-tournament-completed'),
    path('deposit/processed', DepositProcessedView.as_view(), name='deposit-processed'),
    
    # Withdrawals
    path('withdrawals', WithdrawalCreateView.as_view(), name='withdrawal-create'),
    path('withdrawals', WithdrawalListView.as_view(), name='withdrawal-list'),
    path('withdrawals/<int:id>', WithdrawalDetailView.as_view(), name='withdrawal-detail'),
    
    # Notifications
    path('notifications', NotificationListView.as_view(), name='notification-list'),
    path('notifications/<int:id>/read', NotificationReadView.as_view(), name='notification-read'),
    path('notifications/push-subscribe', PushSubscribeView.as_view(), name='push-subscribe'),
    
    # Admin
    path('admin/users', AdminUserListView.as_view(), name='admin-user-list'),
    path('admin/users/<int:user_id>', AdminUserDetailView.as_view(), name='admin-user-detail'),
    path('admin/users/<int:user_id>', AdminUserUpdateView.as_view(), name='admin-user-update'),
    path('admin/transactions', AdminTransactionListView.as_view(), name='admin-transaction-list'),
    path('admin/withdrawals', AdminWithdrawalListView.as_view(), name='admin-withdrawal-list'),
    path('admin/withdrawals/<int:id>', AdminWithdrawalUpdateView.as_view(), name='admin-withdrawal-update'),
    path('admin/stats', AdminStatsView.as_view(), name='admin-stats'),
    path('admin/analytics', AdminAnalyticsView.as_view(), name='admin-analytics'),
]