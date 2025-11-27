from rest_framework import serializers
from api.models import Member, Transaction, Withdrawal, Notification, PushSubscription


class MessageSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=200)
    timestamp = serializers.DateTimeField(read_only=True)


class TelegramAuthSerializer(serializers.Serializer):
    """Serializer for Telegram authentication"""
    telegram_id = serializers.IntegerField(required=True)
    username = serializers.CharField(max_length=255, required=False, allow_null=True, allow_blank=True)
    first_name = serializers.CharField(max_length=255, required=True)
    last_name = serializers.CharField(max_length=255, required=False, allow_null=True, allow_blank=True)
    photo_url = serializers.URLField(max_length=500, required=False, allow_null=True, allow_blank=True)
    auth_date = serializers.IntegerField(required=True)
    hash = serializers.CharField(required=True)


class MemberSerializer(serializers.ModelSerializer):
    """Full information about user"""
    class Meta:
        model = Member
        fields = [
            'id',
            'telegram_id',
            'username',
            'first_name',
            'last_name',
            'photo_url',
            'user_type',
            'referral_code',
            'created_at'
        ]
        read_only_fields = ['id', 'referral_code', 'created_at']


class MemberStatsSerializer(serializers.Serializer):
    """User statistics"""
    user_id = serializers.IntegerField()
    balance = serializers.DecimalField(max_digits=20, decimal_places=2)
    rank = serializers.CharField()
    referral_count = serializers.IntegerField()
    total_earnings = serializers.DecimalField(max_digits=20, decimal_places=2)


class MemberUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating user profile"""
    class Meta:
        model = Member
        fields = ['user_type']


class ReferralSerializer(serializers.ModelSerializer):
    """Information about referral with level"""
    level = serializers.IntegerField(read_only=True)
    registered_at = serializers.DateTimeField(source='created_at', read_only=True)
    
    class Meta:
        model = Member
        fields = [
            'id',
            'telegram_id',
            'username',
            'first_name',
            'last_name',
            'photo_url',
            'user_type',
            'level',
            'registered_at'
        ]
        read_only_fields = fields


class ReferralTreeSerializer(serializers.ModelSerializer):
    """Recursive serializer for referral tree visualization"""
    level = serializers.IntegerField(read_only=True)
    direct_referrals_count = serializers.IntegerField(read_only=True)
    total_referrals_count = serializers.IntegerField(read_only=True)
    registered_at = serializers.DateTimeField(source='created_at', read_only=True)
    children = serializers.SerializerMethodField()
    
    class Meta:
        model = Member
        fields = [
            'id',
            'telegram_id',
            'username',
            'first_name',
            'user_type',
            'level',
            'direct_referrals_count',
            'total_referrals_count',
            'registered_at',
            'children'
        ]
        read_only_fields = fields
    
    def get_children(self, obj):
        if hasattr(obj, 'children_list'):
            return ReferralTreeSerializer(obj.children_list, many=True).data
        return []


class TransactionSerializer(serializers.ModelSerializer):
    """Transaction serializer"""
    related_user_id = serializers.IntegerField(source='related_user.id', read_only=True, allow_null=True)
    related_user_name = serializers.SerializerMethodField()
    referral_level = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    
    class Meta:
        model = Transaction
        fields = [
            'id',
            'transaction_type',
            'currency_type',
            'amount',
            'description',
            'referral_level',
            'related_user_id',
            'related_user_name',
            'status',
            'created_at'
        ]
        read_only_fields = fields
    
    def get_related_user_name(self, obj):
        if obj.related_user:
            return f"{obj.related_user.first_name} {obj.related_user.last_name}".strip()
        return None
    
    def get_referral_level(self, obj):
        # Extract level from description if it's a referral bonus
        if obj.transaction_type in ['referral_bonus', 'depth_bonus', 'deposit_percent']:
            # Try to parse level from description
            import re
            match = re.search(r'level (\d+)', obj.description, re.IGNORECASE)
            if match:
                return int(match.group(1))
        return None
    
    def get_status(self, obj):
        # All transactions in our system are completed
        return 'completed'


class TransactionFilterSerializer(serializers.Serializer):
    """Filters for transaction list"""
    page = serializers.IntegerField(min_value=1, default=1, required=False)
    page_size = serializers.IntegerField(min_value=1, max_value=100, default=20, required=False)
    currency_type = serializers.ChoiceField(choices=['vcoins', 'rubles'], required=False)
    transaction_type = serializers.ChoiceField(
        choices=['referral_bonus', 'tournament_bonus', 'deposit_bonus', 'withdrawal', 'tournament_reward'],
        required=False
    )
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)


class WithdrawalSerializer(serializers.ModelSerializer):
    """Withdrawal request serializer"""
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    rejection_reason = serializers.CharField(read_only=True, allow_null=True)
    transaction_id = serializers.CharField(read_only=True, allow_null=True)
    
    class Meta:
        model = Withdrawal
        fields = [
            'id',
            'user_id',
            'amount',
            'method',
            'wallet_address',
            'status',
            'rejection_reason',
            'created_at',
            'processed_at',
            'transaction_id'
        ]
        read_only_fields = ['id', 'user_id', 'status', 'created_at', 'processed_at', 'rejection_reason', 'transaction_id']


class WithdrawalCreateSerializer(serializers.ModelSerializer):
    """Create withdrawal request"""
    class Meta:
        model = Withdrawal
        fields = ['amount', 'method', 'wallet_address']
    
    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than 0")
        return value
    
    def validate_method(self, value):
        if value not in ['card', 'crypto']:
            raise serializers.ValidationError("Method must be 'card' or 'crypto'")
        return value


class NotificationSerializer(serializers.ModelSerializer):
    """Notification serializer"""
    data = serializers.JSONField(required=False, allow_null=True)
    
    class Meta:
        model = Notification
        fields = [
            'id',
            'title',
            'message',
            'notification_type',
            'is_read',
            'created_at',
            'data'
        ]
        read_only_fields = ['id', 'created_at']
    
    def to_representation(self, instance):
        representation = super().to_representation(instance)
        # Add data field as empty dict if not present
        if 'data' not in representation or representation['data'] is None:
            representation['data'] = {}
        return representation


class AdminUserSerializer(serializers.ModelSerializer):
    """Extended user information for admin"""
    referred_by = serializers.SerializerMethodField()
    total_referrals = serializers.SerializerMethodField()
    total_earnings = serializers.SerializerMethodField()
    updated_at = serializers.DateTimeField(read_only=True)
    
    class Meta:
        model = Member
        fields = [
            'id',
            'telegram_id',
            'username',
            'first_name',
            'last_name',
            'photo_url',
            'user_type',
            'rank',
            'v_coins_balance',
            'cash_balance',
            'is_blocked',
            'referral_code',
            'referred_by',
            'total_referrals',
            'total_earnings',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'telegram_id', 'referral_code', 'created_at']
    
    def get_referred_by(self, obj):
        if obj.referrer:
            return {
                'id': obj.referrer.id,
                'username': obj.referrer.username,
                'first_name': obj.referrer.first_name
            }
        return None
    
    def get_total_referrals(self, obj):
        return obj.referrals.count()
    
    def get_total_earnings(self, obj):
        total = obj.transactions.filter(
            transaction_type__in=['referral_bonus', 'depth_bonus', 'deposit_percent']
        ).aggregate(total=serializers.models.Sum('amount'))['total']
        return total or 0


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    """Update user by admin"""
    class Meta:
        model = Member
        fields = [
            'user_type',
            'rank',
            'v_coins_balance',
            'cash_balance',
            'is_blocked'
        ]


class AdminStatsSerializer(serializers.Serializer):
    """General system statistics"""
    total_users = serializers.IntegerField()
    total_players = serializers.IntegerField()
    total_influencers = serializers.IntegerField()
    total_v_coins = serializers.DecimalField(max_digits=20, decimal_places=2)
    total_cash_payouts = serializers.DecimalField(max_digits=20, decimal_places=2)
    total_transactions = serializers.IntegerField()
    pending_withdrawals = serializers.IntegerField()
    pending_withdrawals_amount = serializers.DecimalField(max_digits=20, decimal_places=2)


class AdminAnalyticsSerializer(serializers.Serializer):
    """System analytics"""
    registrations_by_day = serializers.ListField(
        child=serializers.DictField()
    )
    activity_by_day = serializers.ListField(
        child=serializers.DictField()
    )
    top_referrers = serializers.ListField(
        child=serializers.DictField()
    )


class PushSubscriptionSerializer(serializers.ModelSerializer):
    """Push notification subscription"""
    subscription = serializers.JSONField(source='subscription_data')
    
    class Meta:
        model = PushSubscription
        fields = ['subscription']
    
    def create(self, validated_data):
        user = self.context['request'].user
        subscription_data = validated_data.get('subscription_data')
        
        # Remove old subscriptions for this user
        PushSubscription.objects.filter(user=user).delete()
        
        # Create new subscription
        return PushSubscription.objects.create(
            user=user,
            subscription_data=subscription_data
        )


class UserRegisterSerializer(serializers.Serializer):
    """User registration with referral code"""
    telegram_id = serializers.IntegerField(required=True)
    username = serializers.CharField(max_length=255, required=False, allow_null=True, allow_blank=True)
    first_name = serializers.CharField(max_length=255, required=True)
    last_name = serializers.CharField(max_length=255, required=False, allow_null=True, allow_blank=True)
    photo_url = serializers.URLField(max_length=500, required=False, allow_null=True, allow_blank=True)
    referrer_code = serializers.CharField(max_length=20, required=False, allow_null=True, allow_blank=True)