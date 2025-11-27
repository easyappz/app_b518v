from django.db import models
import secrets
import string


class Member(models.Model):
    """Custom user model for the referral system"""
    
    USER_TYPE_CHOICES = [
        ('player', 'Player'),
        ('influencer', 'Influencer'),
    ]
    
    RANK_CHOICES = [
        ('standard', 'Standard'),
        ('silver', 'Silver'),
        ('gold', 'Gold'),
        ('platinum', 'Platinum'),
    ]
    
    telegram_id = models.BigIntegerField(unique=True, db_index=True)
    username = models.CharField(max_length=255, null=True, blank=True)
    first_name = models.CharField(max_length=255, default='')
    last_name = models.CharField(max_length=255, default='', blank=True)
    photo_url = models.URLField(max_length=500, null=True, blank=True)
    
    referrer = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='referrals'
    )
    referral_code = models.CharField(max_length=20, unique=True, db_index=True)
    
    user_type = models.CharField(
        max_length=20,
        choices=USER_TYPE_CHOICES,
        default='player'
    )
    rank = models.CharField(
        max_length=20,
        choices=RANK_CHOICES,
        default='standard'
    )
    
    v_coins_balance = models.DecimalField(
        max_digits=20,
        decimal_places=2,
        default=0
    )
    cash_balance = models.DecimalField(
        max_digits=20,
        decimal_places=2,
        default=0
    )
    total_deposits = models.DecimalField(
        max_digits=20,
        decimal_places=2,
        default=0
    )
    
    active_referrals_count = models.IntegerField(default=0)
    
    is_admin = models.BooleanField(default=False)
    is_blocked = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'members'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.username or self.telegram_id} ({self.user_type})"
    
    @property
    def is_authenticated(self):
        """Always return True for authenticated users (required for DRF)"""
        return True
    
    @property
    def is_anonymous(self):
        """Always return False (required for DRF)"""
        return False
    
    def has_perm(self, perm, obj=None):
        """Check if user has a specific permission (required for DRF permissions)"""
        return self.is_admin
    
    def has_module_perms(self, app_label):
        """Check if user has permissions to view the app (required for DRF)"""
        return self.is_admin
    
    @staticmethod
    def generate_referral_code():
        """Generate a unique referral code"""
        characters = string.ascii_uppercase + string.digits
        while True:
            code = ''.join(secrets.choice(characters) for _ in range(8))
            if not Member.objects.filter(referral_code=code).exists():
                return code
    
    def save(self, *args, **kwargs):
        if not self.referral_code:
            self.referral_code = self.generate_referral_code()
        super().save(*args, **kwargs)


class ReferralRelation(models.Model):
    """Stores referral hierarchy relationships for bonus calculation"""
    
    ancestor = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name='descendant_relations'
    )
    descendant = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name='ancestor_relations'
    )
    level = models.IntegerField()
    has_paid_first_bonus = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'referral_relations'
        unique_together = [['ancestor', 'descendant']]
        indexes = [
            models.Index(fields=['ancestor', 'level']),
            models.Index(fields=['descendant']),
        ]
    
    def __str__(self):
        return f"{self.ancestor} -> {self.descendant} (Level {self.level})"


class Transaction(models.Model):
    """Records all financial transactions in the system"""
    
    CURRENCY_TYPE_CHOICES = [
        ('v_coins', 'V-Coins'),
        ('cash', 'Cash'),
    ]
    
    TRANSACTION_TYPE_CHOICES = [
        ('referral_bonus', 'Referral Bonus'),
        ('depth_bonus', 'Depth Bonus'),
        ('deposit_percent', 'Deposit Percent'),
        ('withdrawal', 'Withdrawal'),
    ]
    
    user = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name='transactions'
    )
    amount = models.DecimalField(max_digits=20, decimal_places=2)
    currency_type = models.CharField(max_length=20, choices=CURRENCY_TYPE_CHOICES)
    transaction_type = models.CharField(max_length=30, choices=TRANSACTION_TYPE_CHOICES)
    
    related_user = models.ForeignKey(
        Member,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='related_transactions'
    )
    
    description = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'transactions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['transaction_type']),
        ]
    
    def __str__(self):
        return f"{self.user} - {self.amount} {self.currency_type} ({self.transaction_type})"


class Withdrawal(models.Model):
    """Withdrawal requests from users"""
    
    METHOD_CHOICES = [
        ('card', 'Bank Card'),
        ('crypto', 'Cryptocurrency'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    user = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name='withdrawals'
    )
    amount = models.DecimalField(max_digits=20, decimal_places=2)
    method = models.CharField(max_length=20, choices=METHOD_CHOICES)
    wallet_address = models.CharField(max_length=500)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'withdrawals'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['status', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.user} - {self.amount} ({self.status})"


class Notification(models.Model):
    """User notifications"""
    
    NOTIFICATION_TYPE_CHOICES = [
        ('bonus', 'Bonus'),
        ('rank_up', 'Rank Up'),
        ('withdrawal', 'Withdrawal'),
        ('system', 'System'),
    ]
    
    user = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(
        max_length=20,
        choices=NOTIFICATION_TYPE_CHOICES
    )
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.user} - {self.title}"


class PushSubscription(models.Model):
    """Web push notification subscriptions"""
    
    user = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name='push_subscriptions'
    )
    subscription_data = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'push_subscriptions'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user} - Push Subscription"
