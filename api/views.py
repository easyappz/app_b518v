from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.utils import timezone
from django.contrib.sessions.models import Session
from django.db import transaction as db_transaction
from django.db.models import Count, Q, Sum
from rest_framework.pagination import PageNumberPagination
from drf_spectacular.utils import extend_schema
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta
from decimal import Decimal

from .serializers import (
    MessageSerializer,
    TelegramAuthSerializer,
    LoginSerializer,
    RegisterSerializer,
    MemberSerializer,
    MemberStatsSerializer,
    MemberUpdateSerializer,
    UserRegisterSerializer,
    ReferralSerializer,
    ReferralTreeSerializer,
    TransactionSerializer,
    TransactionFilterSerializer,
    WithdrawalSerializer,
    WithdrawalCreateSerializer,
    NotificationSerializer,
    PushSubscriptionSerializer,
    AdminUserSerializer,
    AdminUserUpdateSerializer,
    AdminStatsSerializer,
    AdminAnalyticsSerializer
)
from .models import Member, Transaction, ReferralRelation, Notification, Withdrawal, PushSubscription

# Constants for bonus calculation
PLAYER_DIRECT_BONUS = 1000  # V-Coins
INFLUENCER_DIRECT_BONUS = 500  # Rubles

RANK_THRESHOLDS = {
    'standard': 0,
    'silver': 5,
    'gold': 20,
    'platinum': 50
}

DEPTH_BONUSES_PLAYER = {
    'standard': 100,
    'silver': 150,
    'gold': 200,
    'platinum': 250
}

DEPTH_BONUSES_INFLUENCER = {
    'standard': 50,
    'silver': 75,
    'gold': 100,
    'platinum': 125
}

MAX_REFERRAL_DEPTH = 10
DEPOSIT_PERCENT = Decimal('0.10')  # 10% from deposit for influencer


class CookieAuthentication(BaseAuthentication):
    """
    Custom authentication class using HttpOnly cookies
    """
    def authenticate(self, request):
        session_token = request.COOKIES.get('session_token')
        
        if not session_token:
            return None
        
        try:
            # Get session from database
            session = Session.objects.get(session_key=session_token)
            session_data = session.get_decoded()
            
            # Check if session has expired
            if session.expire_date < timezone.now():
                return None
            
            # Get user ID from session
            user_id = session_data.get('user_id')
            if not user_id:
                return None
            
            # Get user
            user = Member.objects.get(id=user_id)
            
            # Check if user is blocked
            if user.is_blocked:
                raise AuthenticationFailed('User is blocked')
            
            return (user, None)
        
        except (Session.DoesNotExist, Member.DoesNotExist):
            return None
    
    def authenticate_header(self, request):
        return 'Cookie'


def build_referral_chain(new_user, referrer):
    """
    Build referral chain up to 10 levels
    Creates ReferralRelation entries for all ancestors
    """
    if not referrer:
        return
    
    # Check for circular reference
    if new_user.id == referrer.id:
        return
    
    # Get all ancestors of the referrer
    ancestor_relations = ReferralRelation.objects.filter(
        descendant=referrer,
        level__lt=MAX_REFERRAL_DEPTH
    ).select_related('ancestor')
    
    relations_to_create = []
    
    # Direct referral relationship (level 1)
    relations_to_create.append(
        ReferralRelation(
            ancestor=referrer,
            descendant=new_user,
            level=1
        )
    )
    
    # Add relationships with all ancestors up to level 10
    for relation in ancestor_relations:
        new_level = relation.level + 1
        if new_level <= MAX_REFERRAL_DEPTH:
            # Check for circular reference
            if relation.ancestor.id != new_user.id:
                relations_to_create.append(
                    ReferralRelation(
                        ancestor=relation.ancestor,
                        descendant=new_user,
                        level=new_level
                    )
                )
    
    # Bulk create all relations
    ReferralRelation.objects.bulk_create(relations_to_create, ignore_conflicts=True)


def check_rank_upgrade(user):
    """
    Check and update user rank based on active referrals count
    """
    active_count = user.active_referrals_count
    
    new_rank = 'standard'
    if active_count >= RANK_THRESHOLDS['platinum']:
        new_rank = 'platinum'
    elif active_count >= RANK_THRESHOLDS['gold']:
        new_rank = 'gold'
    elif active_count >= RANK_THRESHOLDS['silver']:
        new_rank = 'silver'
    
    if new_rank != user.rank:
        old_rank = user.rank
        user.rank = new_rank
        user.save(update_fields=['rank'])
        
        # Create notification about rank upgrade
        create_notification(
            user=user,
            title='Rank Upgrade',
            message=f'Congratulations! Your rank has been upgraded from {old_rank} to {new_rank}',
            notification_type='rank_upgrade'
        )


def get_depth_bonus_amount(user_type, rank, level):
    """
    Calculate depth bonus amount based on user type, rank and referral level
    """
    if level < 1 or level > MAX_REFERRAL_DEPTH:
        return 0
    
    if user_type == 'influencer':
        return DEPTH_BONUSES_INFLUENCER.get(rank, 0)
    else:
        return DEPTH_BONUSES_PLAYER.get(rank, 0)


def create_notification(user, title, message, notification_type, data=None):
    """
    Create notification for user
    
    Args:
        user: Member instance
        title: Notification title
        message: Notification message
        notification_type: Type of notification
        data: Additional notification data (optional)
    
    Returns:
        Notification instance
    """
    return Notification.objects.create(
        user=user,
        title=title,
        message=message,
        notification_type=notification_type,
        data=data or {}
    )


def create_session(user):
    """
    Create a session for the user and return session token
    """
    # Generate session token
    session_token = secrets.token_urlsafe(32)
    
    # Create session
    session = Session.objects.create(
        session_key=session_token,
        session_data=Session.objects.encode({
            'user_id': user.id,
            'created_at': timezone.now().isoformat()
        }),
        expire_date=timezone.now() + timezone.timedelta(days=30)
    )
    
    return session_token


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class RegisterView(APIView):
    """
    Register new user with username and password
    POST /api/auth/register
    """
    authentication_classes = []
    permission_classes = []
    
    @extend_schema(
        request=RegisterSerializer,
        responses={201: MemberSerializer}
    )
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'error': 'Invalid request data'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        data = serializer.validated_data
        username = data['username']
        password = data['password']
        first_name = data.get('first_name', '')
        
        # Check if username already exists
        if Member.objects.filter(username=username).exists():
            return Response(
                {'error': 'Username already exists'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create new user
        user = Member.objects.create(
            username=username,
            first_name=first_name,
            user_type='player'
        )
        
        # Set password
        user.set_password(password)
        user.save()
        
        # Create session
        session_token = create_session(user)
        
        # Prepare response
        response_serializer = MemberSerializer(user)
        response = Response(response_serializer.data, status=status.HTTP_201_CREATED)
        
        # Set HttpOnly cookie
        response.set_cookie(
            key='session_token',
            value=session_token,
            httponly=True,
            samesite='Lax',
            max_age=60 * 60 * 24 * 30,  # 30 days
            secure=False  # Set to True in production with HTTPS
        )
        
        return response


class LoginView(APIView):
    """
    Login with username and password
    POST /api/auth/login
    """
    authentication_classes = []
    permission_classes = []
    
    @extend_schema(
        request=LoginSerializer,
        responses={200: MemberSerializer}
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'error': 'Invalid request data'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        data = serializer.validated_data
        username = data['username']
        password = data['password']
        
        # Find user by username
        try:
            user = Member.objects.get(username=username)
        except Member.DoesNotExist:
            return Response(
                {'error': 'Invalid username or password'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Check password
        if not user.check_password(password):
            return Response(
                {'error': 'Invalid username or password'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Check if user is blocked
        if user.is_blocked:
            return Response(
                {'error': 'User is blocked'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Create session
        session_token = create_session(user)
        
        # Prepare response
        response_serializer = MemberSerializer(user)
        response = Response(response_serializer.data, status=status.HTTP_200_OK)
        
        # Set HttpOnly cookie
        response.set_cookie(
            key='session_token',
            value=session_token,
            httponly=True,
            samesite='Lax',
            max_age=60 * 60 * 24 * 30,  # 30 days
            secure=False  # Set to True in production with HTTPS
        )
        
        return response


class TelegramAuthView(APIView):
    """
    Authenticate user via Telegram
    POST /api/auth/telegram
    """
    authentication_classes = []
    permission_classes = []
    
    @extend_schema(
        request=TelegramAuthSerializer,
        responses={200: MemberSerializer}
    )
    def post(self, request):
        serializer = TelegramAuthSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'detail': 'Invalid request data'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        data = serializer.validated_data
        
        # Verify Telegram hash
        if not self.verify_telegram_auth(data):
            return Response(
                {'detail': 'Invalid Telegram authentication'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Create or update user
        user, created = Member.objects.update_or_create(
            telegram_id=data['telegram_id'],
            defaults={
                'username': data.get('username'),
                'first_name': data.get('first_name', ''),
                'last_name': data.get('last_name', ''),
                'photo_url': data.get('photo_url'),
            }
        )
        
        # Create session
        session_token = create_session(user)
        
        # Prepare response
        response_serializer = MemberSerializer(user)
        response = Response(response_serializer.data, status=status.HTTP_200_OK)
        
        # Set HttpOnly cookie
        response.set_cookie(
            key='session_token',
            value=session_token,
            httponly=True,
            samesite='Lax',
            max_age=60 * 60 * 24 * 30,  # 30 days
            secure=False  # Set to True in production with HTTPS
        )
        
        return response
    
    def verify_telegram_auth(self, data):
        """
        Verify Telegram authentication hash
        """
        # Telegram bot token (in production, use environment variable)
        BOT_TOKEN = "your_bot_token_here"
        
        # For development, skip verification
        # In production, implement proper verification:
        # 1. Create data_check_string from all fields except hash
        # 2. Create secret_key = SHA256(BOT_TOKEN)
        # 3. Calculate HMAC-SHA256 of data_check_string using secret_key
        # 4. Compare with provided hash
        
        return True


class LogoutView(APIView):
    """
    Logout current user
    POST /api/auth/logout
    """
    authentication_classes = [CookieAuthentication]
    
    @extend_schema(
        responses={200: {'type': 'object', 'properties': {'message': {'type': 'string'}}}}
    )
    def post(self, request):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {'detail': 'Not authenticated'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Delete session
        session_token = request.COOKIES.get('session_token')
        if session_token:
            try:
                session = Session.objects.get(session_key=session_token)
                session.delete()
            except Session.DoesNotExist:
                pass
        
        # Prepare response
        response = Response(
            {'message': 'Logged out successfully'},
            status=status.HTTP_200_OK
        )
        
        # Delete cookie
        response.delete_cookie('session_token')
        
        return response


class CurrentUserView(APIView):
    """
    Get current authenticated user
    GET /api/auth/me
    """
    authentication_classes = [CookieAuthentication]
    
    @extend_schema(
        responses={200: MemberSerializer}
    )
    def get(self, request):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {'detail': 'Not authenticated'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        serializer = MemberSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)


class UserDetailView(APIView):
    """
    Get user by ID
    GET /api/users/{user_id}
    """
    authentication_classes = [CookieAuthentication]
    
    @extend_schema(
        responses={200: MemberSerializer}
    )
    def get(self, request, user_id):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {'detail': 'Not authenticated'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        try:
            user = Member.objects.get(id=user_id)
        except Member.DoesNotExist:
            return Response(
                {'detail': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = MemberSerializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)


class UserUpdateView(APIView):
    """
    Update user profile
    PATCH /api/users/{user_id}
    """
    authentication_classes = [CookieAuthentication]
    
    @extend_schema(
        request=MemberUpdateSerializer,
        responses={200: MemberSerializer}
    )
    def patch(self, request, user_id):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {'detail': 'Not authenticated'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Check if user is updating their own profile
        if request.user.id != int(user_id):
            return Response(
                {'detail': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            user = Member.objects.get(id=user_id)
        except Member.DoesNotExist:
            return Response(
                {'detail': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = MemberUpdateSerializer(user, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(
                {'detail': 'Invalid request data'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer.save()
        
        response_serializer = MemberSerializer(user)
        return Response(response_serializer.data, status=status.HTTP_200_OK)


class UserStatsView(APIView):
    """
    Get user statistics
    GET /api/users/{user_id}/stats
    """
    authentication_classes = [CookieAuthentication]
    
    @extend_schema(
        responses={200: MemberStatsSerializer}
    )
    def get(self, request, user_id):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {'detail': 'Not authenticated'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        try:
            user = Member.objects.get(id=user_id)
        except Member.DoesNotExist:
            return Response(
                {'detail': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Calculate statistics
        # Balance based on user type
        balance = user.cash_balance if user.user_type == 'influencer' else user.v_coins_balance
        
        # Count referrals
        referral_count = user.referrals.count()
        
        # Calculate total earnings
        total_earnings = Transaction.objects.filter(
            user=user,
            transaction_type__in=['referral_bonus', 'depth_bonus', 'deposit_percent']
        ).aggregate(total=Sum('amount'))['total'] or 0
        
        stats = {
            'user_id': user.id,
            'balance': balance,
            'rank': user.rank,
            'referral_count': referral_count,
            'total_earnings': total_earnings
        }
        
        serializer = MemberStatsSerializer(stats)
        return Response(serializer.data, status=status.HTTP_200_OK)


class RegisterWithReferralView(APIView):
    """
    Register user with referral code
    POST /api/user/register
    """
    authentication_classes = []
    permission_classes = []
    
    @extend_schema(
        request=UserRegisterSerializer,
        responses={201: MemberSerializer}
    )
    def post(self, request):
        serializer = UserRegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'detail': 'Invalid request data'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        data = serializer.validated_data
        referrer_code = data.get('referrer_code')
        
        # Check if user already exists
        if Member.objects.filter(telegram_id=data['telegram_id']).exists():
            return Response(
                {'detail': 'User already exists'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Find referrer if code provided
        referrer = None
        if referrer_code:
            try:
                referrer = Member.objects.get(referral_code=referrer_code)
            except Member.DoesNotExist:
                return Response(
                    {'detail': 'Invalid referral code'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Create user with atomic transaction
        with db_transaction.atomic():
            # Create new user
            new_user = Member.objects.create(
                telegram_id=data['telegram_id'],
                username=data.get('username'),
                first_name=data.get('first_name', ''),
                last_name=data.get('last_name', ''),
                photo_url=data.get('photo_url'),
                referrer=referrer
            )
            
            # Build referral chain if referrer exists
            if referrer:
                # Check for circular reference
                if new_user.id == referrer.id:
                    db_transaction.set_rollback(True)
                    return Response(
                        {'detail': 'Circular referral detected'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Build referral chain
                build_referral_chain(new_user, referrer)
                
                # Give direct bonus to referrer
                if referrer.user_type == 'influencer':
                    referrer.cash_balance += INFLUENCER_DIRECT_BONUS
                    bonus_amount = INFLUENCER_DIRECT_BONUS
                    currency_type = 'cash'
                else:
                    referrer.v_coins_balance += PLAYER_DIRECT_BONUS
                    bonus_amount = PLAYER_DIRECT_BONUS
                    currency_type = 'v_coins'
                
                # Update active referrals count
                referrer.active_referrals_count += 1
                referrer.save(update_fields=['cash_balance', 'v_coins_balance', 'active_referrals_count'])
                
                # Create transaction record for direct bonus
                Transaction.objects.create(
                    user=referrer,
                    amount=bonus_amount,
                    currency_type=currency_type,
                    transaction_type='referral_bonus',
                    related_user=new_user,
                    description=f'Direct referral bonus from {new_user.first_name} (level 1)'
                )
                
                # Create notification for referrer
                create_notification(
                    user=referrer,
                    title='New Referral',
                    message=f'{new_user.first_name} joined using your referral link! You received {bonus_amount} {"₽" if currency_type == "cash" else "V-Coins"}',
                    notification_type='referral_bonus'
                )
                
                # Check rank upgrade for referrer
                check_rank_upgrade(referrer)
        
        response_serializer = MemberSerializer(new_user)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class UserReferralsView(APIView):
    """
    Get user referrals with depth filter
    GET /api/user/{user_id}/referrals
    """
    authentication_classes = [CookieAuthentication]
    
    @extend_schema(
        responses={200: {'type': 'object'}}
    )
    def get(self, request, user_id):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {'detail': 'Not authenticated'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        try:
            user = Member.objects.get(id=user_id)
        except Member.DoesNotExist:
            return Response(
                {'detail': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check access permission
        if request.user.id != user.id and not request.user.is_admin:
            return Response(
                {'detail': 'Access denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get depth parameter (1-10)
        depth = int(request.query_params.get('depth', 1))
        if depth < 1:
            depth = 1
        elif depth > MAX_REFERRAL_DEPTH:
            depth = MAX_REFERRAL_DEPTH
        
        # Get all referrals up to specified depth
        referral_relations = ReferralRelation.objects.filter(
            ancestor=user,
            level__lte=depth
        ).select_related('descendant').order_by('level', 'created_at')
        
        # Build nested structure
        referrals_by_level = {}
        for relation in referral_relations:
            level = relation.level
            if level not in referrals_by_level:
                referrals_by_level[level] = []
            
            descendant = relation.descendant
            referral_data = {
                'id': descendant.id,
                'telegram_id': descendant.telegram_id,
                'username': descendant.username,
                'first_name': descendant.first_name,
                'last_name': descendant.last_name,
                'photo_url': descendant.photo_url,
                'user_type': descendant.user_type,
                'level': level,
                'registered_at': descendant.created_at,
                'referrals': []
            }
            referrals_by_level[level].append(referral_data)
        
        # Build hierarchical structure
        def build_tree(parent_id, current_level):
            if current_level > depth:
                return []
            
            children = []
            for ref in referrals_by_level.get(current_level, []):
                # Check if this referral belongs to this parent
                if current_level == 1:
                    # Direct referrals
                    if Member.objects.filter(id=ref['id'], referrer_id=user.id).exists():
                        ref['referrals'] = build_tree(ref['id'], current_level + 1)
                        children.append(ref)
                else:
                    # Indirect referrals
                    if Member.objects.filter(id=ref['id'], referrer_id=parent_id).exists():
                        ref['referrals'] = build_tree(ref['id'], current_level + 1)
                        children.append(ref)
            return children
        
        referrals = build_tree(user.id, 1)
        total_referrals = sum(len(refs) for refs in referrals_by_level.values())
        
        return Response({
            'user_id': user.id,
            'total_referrals': total_referrals,
            'depth': depth,
            'referrals': referrals
        }, status=status.HTTP_200_OK)


class ReferralTreeView(APIView):
    """
    Get full referral tree for visualization
    GET /api/user/{user_id}/referral-tree
    """
    authentication_classes = [CookieAuthentication]
    
    @extend_schema(
        responses={200: {'type': 'object'}}
    )
    def get(self, request, user_id):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {'detail': 'Not authenticated'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        try:
            user = Member.objects.get(id=user_id)
        except Member.DoesNotExist:
            return Response(
                {'detail': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check access permission
        if request.user.id != user.id and not request.user.is_admin:
            return Response(
                {'detail': 'Access denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get all descendant relations
        all_relations = ReferralRelation.objects.filter(
            ancestor=user
        ).select_related('descendant').order_by('level', 'created_at')
        
        # Count referrals per level
        levels = {}
        for relation in all_relations:
            level = str(relation.level)
            levels[level] = levels.get(level, 0) + 1
        
        # Build tree structure recursively
        def build_tree_node(node_user, current_level=1):
            if current_level > MAX_REFERRAL_DEPTH:
                return None
            
            # Get direct referrals
            direct_referrals = Member.objects.filter(referrer=node_user).order_by('created_at')
            
            children = []
            for child in direct_referrals:
                # Count this child's total referrals
                child_total = ReferralRelation.objects.filter(ancestor=child).count()
                child_direct = Member.objects.filter(referrer=child).count()
                
                child_node = {
                    'id': child.id,
                    'telegram_id': child.telegram_id,
                    'username': child.username,
                    'first_name': child.first_name,
                    'user_type': child.user_type,
                    'level': current_level,
                    'direct_referrals_count': child_direct,
                    'total_referrals_count': child_total,
                    'registered_at': child.created_at,
                    'children': []
                }
                
                # Recursively build children if not at max depth
                if current_level < MAX_REFERRAL_DEPTH:
                    child_tree = build_tree_node(child, current_level + 1)
                    if child_tree:
                        child_node['children'] = child_tree
                
                children.append(child_node)
            
            return children
        
        tree = build_tree_node(user, 1)
        total_referrals = ReferralRelation.objects.filter(ancestor=user).count()
        
        return Response({
            'user_id': user.id,
            'referral_code': user.referral_code,
            'total_referrals': total_referrals,
            'levels': levels,
            'tree': tree
        }, status=status.HTTP_200_OK)


class ReferralLinkView(APIView):
    """
    Get user referral link
    GET /api/referral/link/{user_id}
    """
    authentication_classes = [CookieAuthentication]
    
    @extend_schema(
        responses={200: {'type': 'object'}}
    )
    def get(self, request, user_id):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {'detail': 'Not authenticated'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        try:
            user = Member.objects.get(id=user_id)
        except Member.DoesNotExist:
            return Response(
                {'detail': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check access permission
        if request.user.id != user.id and not request.user.is_admin:
            return Response(
                {'detail': 'Access denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Generate referral link
        base_url = request.build_absolute_uri('/')[:-1]  # Remove trailing slash
        referral_link = f"{base_url}/ref/{user.referral_code}"
        qr_code_url = f"{base_url}/api/qr/{user.referral_code}"
        
        return Response({
            'user_id': user.id,
            'referral_code': user.referral_code,
            'referral_link': referral_link,
            'qr_code_url': qr_code_url
        }, status=status.HTTP_200_OK)


class TransactionListView(APIView):
    """
    Get list of transactions for current user
    GET /api/transactions
    """
    authentication_classes = [CookieAuthentication]
    
    @extend_schema(
        parameters=[
            {'name': 'page', 'in': 'query', 'schema': {'type': 'integer'}},
            {'name': 'page_size', 'in': 'query', 'schema': {'type': 'integer'}},
            {'name': 'currency_type', 'in': 'query', 'schema': {'type': 'string'}},
            {'name': 'transaction_type', 'in': 'query', 'schema': {'type': 'string'}},
            {'name': 'date_from', 'in': 'query', 'schema': {'type': 'string', 'format': 'date'}},
            {'name': 'date_to', 'in': 'query', 'schema': {'type': 'string', 'format': 'date'}},
        ],
        responses={200: TransactionSerializer(many=True)}
    )
    def get(self, request):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {'detail': 'Not authenticated'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Get query parameters
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        currency_type = request.query_params.get('currency_type')
        transaction_type = request.query_params.get('transaction_type')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        
        # Validate page_size
        if page_size < 1:
            page_size = 20
        if page_size > 100:
            page_size = 100
        
        # Build query
        queryset = Transaction.objects.filter(user=request.user).select_related('related_user')
        
        # Apply filters
        if currency_type:
            # Map currency_type from API spec to model
            currency_map = {
                'vcoins': 'v_coins',
                'rubles': 'cash'
            }
            model_currency = currency_map.get(currency_type)
            if model_currency:
                queryset = queryset.filter(currency_type=model_currency)
        
        if transaction_type:
            # Map transaction types from API spec to model
            type_map = {
                'referral_bonus': 'referral_bonus',
                'tournament_bonus': 'depth_bonus',
                'deposit_bonus': 'deposit_percent',
                'withdrawal': 'withdrawal',
                'tournament_reward': 'referral_bonus'
            }
            model_type = type_map.get(transaction_type)
            if model_type:
                queryset = queryset.filter(transaction_type=model_type)
        
        if date_from:
            try:
                date_from_obj = datetime.strptime(date_from, '%Y-%m-%d').date()
                queryset = queryset.filter(created_at__gte=date_from_obj)
            except ValueError:
                pass
        
        if date_to:
            try:
                date_to_obj = datetime.strptime(date_to, '%Y-%m-%d').date()
                # Add one day to include the entire end date
                date_to_obj = date_to_obj + timedelta(days=1)
                queryset = queryset.filter(created_at__lt=date_to_obj)
            except ValueError:
                pass
        
        # Order by date (newest first)
        queryset = queryset.order_by('-created_at')
        
        # Get total count
        total_count = queryset.count()
        
        # Calculate pagination
        start_index = (page - 1) * page_size
        end_index = start_index + page_size
        
        # Get paginated results
        transactions = queryset[start_index:end_index]
        
        # Serialize data
        serializer = TransactionSerializer(transactions, many=True)
        
        # Build pagination URLs
        base_url = request.build_absolute_uri(request.path)
        next_url = None
        previous_url = None
        
        if end_index < total_count:
            next_url = f"{base_url}?page={page + 1}&page_size={page_size}"
        
        if page > 1:
            previous_url = f"{base_url}?page={page - 1}&page_size={page_size}"
        
        return Response({
            'count': total_count,
            'next': next_url,
            'previous': previous_url,
            'results': serializer.data
        }, status=status.HTTP_200_OK)


class FirstTournamentCompletedView(APIView):
    """
    Process first tournament completion for user
    POST /api/tournament/first-completed
    """
    authentication_classes = [CookieAuthentication]
    
    @extend_schema(
        request={'type': 'object'},
        responses={200: {'type': 'object'}}
    )
    def post(self, request):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {'detail': 'Not authenticated'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Get request data
        user_id = request.data.get('user_id')
        tournament_id = request.data.get('tournament_id')
        
        if not user_id or not tournament_id:
            return Response(
                {'detail': 'user_id and tournament_id are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get user
        try:
            user = Member.objects.get(id=user_id)
        except Member.DoesNotExist:
            return Response(
                {'detail': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        bonuses_distributed = []
        
        with db_transaction.atomic():
            # Get all ancestor relations
            ancestor_relations = ReferralRelation.objects.filter(
                descendant=user
            ).select_related('ancestor').order_by('level')
            
            for relation in ancestor_relations:
                # Skip if already paid
                if relation.has_paid_first_bonus:
                    continue
                
                ancestor = relation.ancestor
                level = relation.level
                
                # Level 1: Direct bonus
                if level == 1:
                    if ancestor.user_type == 'influencer':
                        bonus_amount = Decimal(INFLUENCER_DIRECT_BONUS)
                        currency_type = 'cash'
                        ancestor.cash_balance += bonus_amount
                    else:
                        bonus_amount = Decimal(PLAYER_DIRECT_BONUS)
                        currency_type = 'v_coins'
                        ancestor.v_coins_balance += bonus_amount
                    
                    ancestor.save(update_fields=['cash_balance', 'v_coins_balance'])
                    
                    # Create transaction
                    transaction = Transaction.objects.create(
                        user=ancestor,
                        amount=bonus_amount,
                        currency_type=currency_type,
                        transaction_type='referral_bonus',
                        related_user=user,
                        description=f'First tournament bonus from {user.first_name} (level {level})'
                    )
                    
                    # Update active referrals count for direct referrer
                    ancestor.active_referrals_count = Member.objects.filter(
                        referrer=ancestor
                    ).count()
                    ancestor.save(update_fields=['active_referrals_count'])
                    
                    # Check rank upgrade
                    check_rank_upgrade(ancestor)
                    
                    # Create notification
                    create_notification(
                        user=ancestor,
                        title='Tournament Bonus',
                        message=f'{user.first_name} completed their first tournament! You received {bonus_amount} {"₽" if currency_type == "cash" else "V-Coins"}',
                        notification_type='tournament_bonus'
                    )
                    
                    bonuses_distributed.append({
                        'recipient_id': ancestor.id,
                        'level': level,
                        'amount': str(bonus_amount),
                        'currency_type': 'rubles' if currency_type == 'cash' else 'vcoins',
                        'transaction_id': transaction.id
                    })
                
                # Levels 2-10: Depth cashback based on rank
                elif 2 <= level <= MAX_REFERRAL_DEPTH:
                    bonus_amount = Decimal(get_depth_bonus_amount(
                        ancestor.user_type,
                        ancestor.rank,
                        level
                    ))
                    
                    if bonus_amount > 0:
                        if ancestor.user_type == 'influencer':
                            currency_type = 'cash'
                            ancestor.cash_balance += bonus_amount
                        else:
                            currency_type = 'v_coins'
                            ancestor.v_coins_balance += bonus_amount
                        
                        ancestor.save(update_fields=['cash_balance', 'v_coins_balance'])
                        
                        # Create transaction
                        transaction = Transaction.objects.create(
                            user=ancestor,
                            amount=bonus_amount,
                            currency_type=currency_type,
                            transaction_type='depth_bonus',
                            related_user=user,
                            description=f'Depth bonus from {user.first_name} (level {level})'
                        )
                        
                        # Create notification
                        create_notification(
                            user=ancestor,
                            title='Depth Bonus',
                            message=f'Level {level} referral {user.first_name} completed first tournament! You received {bonus_amount} {"₽" if currency_type == "cash" else "V-Coins"}',
                            notification_type='tournament_bonus'
                        )
                        
                        bonuses_distributed.append({
                            'recipient_id': ancestor.id,
                            'level': level,
                            'amount': str(bonus_amount),
                            'currency_type': 'rubles' if currency_type == 'cash' else 'vcoins',
                            'transaction_id': transaction.id
                        })
                
                # Mark as paid
                relation.has_paid_first_bonus = True
                relation.save(update_fields=['has_paid_first_bonus'])
        
        return Response({
            'success': True,
            'user_id': user.id,
            'tournament_id': tournament_id,
            'bonuses_distributed': bonuses_distributed
        }, status=status.HTTP_200_OK)


class DepositProcessedView(APIView):
    """
    Process user deposit and distribute bonuses
    POST /api/deposit/processed
    """
    authentication_classes = [CookieAuthentication]
    
    @extend_schema(
        request={'type': 'object'},
        responses={200: {'type': 'object'}}
    )
    def post(self, request):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {'detail': 'Not authenticated'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Get request data
        user_id = request.data.get('user_id')
        amount = request.data.get('amount')
        deposit_id = request.data.get('deposit_id')
        
        if not user_id or not amount or not deposit_id:
            return Response(
                {'detail': 'user_id, amount and deposit_id are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate amount
        try:
            amount = Decimal(str(amount))
            if amount <= 0:
                raise ValueError
        except (ValueError, TypeError):
            return Response(
                {'detail': 'Invalid amount'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get user
        try:
            user = Member.objects.get(id=user_id)
        except Member.DoesNotExist:
            return Response(
                {'detail': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        bonuses_distributed = []
        
        with db_transaction.atomic():
            # Update user's total deposits
            user.total_deposits += amount
            user.save(update_fields=['total_deposits'])
            
            # Find direct referrer (level 1)
            try:
                direct_relation = ReferralRelation.objects.get(
                    descendant=user,
                    level=1
                )
                referrer = direct_relation.ancestor
                
                # Check if referrer is influencer
                if referrer.user_type == 'influencer':
                    # Calculate 10% bonus
                    bonus_amount = amount * DEPOSIT_PERCENT
                    
                    # Add to referrer's cash balance
                    referrer.cash_balance += bonus_amount
                    referrer.save(update_fields=['cash_balance'])
                    
                    # Create transaction
                    transaction = Transaction.objects.create(
                        user=referrer,
                        amount=bonus_amount,
                        currency_type='cash',
                        transaction_type='deposit_percent',
                        related_user=user,
                        description=f'10% from {user.first_name} deposit of {amount}₽ (level 1)'
                    )
                    
                    # Create notification
                    create_notification(
                        user=referrer,
                        title='Deposit Bonus',
                        message=f'{user.first_name} made a deposit of {amount}₽! You received {bonus_amount}₽ (10%)',
                        notification_type='deposit_bonus'
                    )
                    
                    bonuses_distributed.append({
                        'recipient_id': referrer.id,
                        'level': 1,
                        'amount': str(bonus_amount),
                        'currency_type': 'rubles',
                        'transaction_id': transaction.id
                    })
            
            except ReferralRelation.DoesNotExist:
                # User has no referrer
                pass
        
        return Response({
            'success': True,
            'user_id': user.id,
            'deposit_id': deposit_id,
            'amount': str(amount),
            'bonuses_distributed': bonuses_distributed
        }, status=status.HTTP_200_OK)


class WithdrawalCreateView(APIView):
    """
    Create withdrawal request
    POST /api/withdrawals
    """
    authentication_classes = [CookieAuthentication]
    
    @extend_schema(
        request=WithdrawalCreateSerializer,
        responses={201: WithdrawalSerializer}
    )
    def post(self, request):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {'detail': 'Not authenticated'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Check if user is influencer
        if request.user.user_type != 'influencer':
            return Response(
                {'detail': 'Only influencers can withdraw funds'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = WithdrawalCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'detail': 'Invalid request data'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        amount = serializer.validated_data['amount']
        method = serializer.validated_data['method']
        wallet_address = serializer.validated_data['wallet_address']
        
        # Check sufficient balance
        if request.user.cash_balance < amount:
            return Response(
                {'detail': 'Insufficient balance'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create withdrawal request
        withdrawal = Withdrawal.objects.create(
            user=request.user,
            amount=amount,
            method=method,
            wallet_address=wallet_address,
            status='pending'
        )
        
        response_serializer = WithdrawalSerializer(withdrawal)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class WithdrawalListView(APIView):
    """
    Get list of withdrawal requests for current user
    GET /api/withdrawals
    """
    authentication_classes = [CookieAuthentication]
    
    @extend_schema(
        responses={200: WithdrawalSerializer(many=True)}
    )
    def get(self, request):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {'detail': 'Not authenticated'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Get query parameters
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        status_filter = request.query_params.get('status')
        
        # Validate page_size
        if page_size < 1:
            page_size = 20
        if page_size > 100:
            page_size = 100
        
        # Build query
        queryset = Withdrawal.objects.filter(user=request.user)
        
        # Apply status filter
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Order by date (newest first)
        queryset = queryset.order_by('-created_at')
        
        # Get total count
        total_count = queryset.count()
        
        # Calculate pagination
        start_index = (page - 1) * page_size
        end_index = start_index + page_size
        
        # Get paginated results
        withdrawals = queryset[start_index:end_index]
        
        # Serialize data
        serializer = WithdrawalSerializer(withdrawals, many=True)
        
        # Build pagination URLs
        base_url = request.build_absolute_uri(request.path)
        next_url = None
        previous_url = None
        
        if end_index < total_count:
            next_url = f"{base_url}?page={page + 1}&page_size={page_size}"
        
        if page > 1:
            previous_url = f"{base_url}?page={page - 1}&page_size={page_size}"
        
        return Response({
            'count': total_count,
            'next': next_url,
            'previous': previous_url,
            'results': serializer.data
        }, status=status.HTTP_200_OK)


class WithdrawalDetailView(APIView):
    """
    Get withdrawal request details
    GET /api/withdrawals/{id}
    """
    authentication_classes = [CookieAuthentication]
    
    @extend_schema(
        responses={200: WithdrawalSerializer}
    )
    def get(self, request, id):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {'detail': 'Not authenticated'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        try:
            withdrawal = Withdrawal.objects.get(id=id)
        except Withdrawal.DoesNotExist:
            return Response(
                {'detail': 'Withdrawal not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if user owns this withdrawal
        if withdrawal.user.id != request.user.id:
            return Response(
                {'detail': 'Access denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = WithdrawalSerializer(withdrawal)
        return Response(serializer.data, status=status.HTTP_200_OK)


class NotificationListView(APIView):
    """
    Get list of notifications for current user
    GET /api/notifications
    """
    authentication_classes = [CookieAuthentication]
    
    @extend_schema(
        responses={200: NotificationSerializer(many=True)}
    )
    def get(self, request):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {'detail': 'Not authenticated'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Get query parameters
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        is_read = request.query_params.get('is_read')
        
        # Validate page_size
        if page_size < 1:
            page_size = 20
        if page_size > 100:
            page_size = 100
        
        # Build query
        queryset = Notification.objects.filter(user=request.user)
        
        # Apply is_read filter
        if is_read is not None:
            if is_read.lower() in ['true', '1', 'yes']:
                queryset = queryset.filter(is_read=True)
            elif is_read.lower() in ['false', '0', 'no']:
                queryset = queryset.filter(is_read=False)
        
        # Order by date (newest first)
        queryset = queryset.order_by('-created_at')
        
        # Get total count
        total_count = queryset.count()
        
        # Calculate pagination
        start_index = (page - 1) * page_size
        end_index = start_index + page_size
        
        # Get paginated results
        notifications = queryset[start_index:end_index]
        
        # Serialize data
        serializer = NotificationSerializer(notifications, many=True)
        
        # Build pagination URLs
        base_url = request.build_absolute_uri(request.path)
        next_url = None
        previous_url = None
        
        if end_index < total_count:
            next_url = f"{base_url}?page={page + 1}&page_size={page_size}"
        
        if page > 1:
            previous_url = f"{base_url}?page={page - 1}&page_size={page_size}"
        
        return Response({
            'count': total_count,
            'next': next_url,
            'previous': previous_url,
            'results': serializer.data
        }, status=status.HTTP_200_OK)


class NotificationReadView(APIView):
    """
    Mark notification as read
    PATCH /api/notifications/{id}/read
    """
    authentication_classes = [CookieAuthentication]
    
    @extend_schema(
        responses={200: NotificationSerializer}
    )
    def patch(self, request, id):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {'detail': 'Not authenticated'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        try:
            notification = Notification.objects.get(id=id)
        except Notification.DoesNotExist:
            return Response(
                {'detail': 'Notification not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if user owns this notification
        if notification.user.id != request.user.id:
            return Response(
                {'detail': 'Access denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Mark as read
        notification.is_read = True
        notification.save(update_fields=['is_read'])
        
        serializer = NotificationSerializer(notification)
        return Response(serializer.data, status=status.HTTP_200_OK)


class PushSubscribeView(APIView):
    """
    Subscribe to push notifications
    POST /api/notifications/push-subscribe
    """
    authentication_classes = [CookieAuthentication]
    
    @extend_schema(
        request=PushSubscriptionSerializer,
        responses={200: {'type': 'object'}}
    )
    def post(self, request):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {'detail': 'Not authenticated'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        serializer = PushSubscriptionSerializer(
            data=request.data,
            context={'request': request}
        )
        
        if not serializer.is_valid():
            return Response(
                {'detail': 'Invalid subscription data'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        subscription = serializer.save()
        
        return Response({
            'message': 'Subscribed to push notifications successfully',
            'subscription_id': subscription.id
        }, status=status.HTTP_200_OK)


class AdminUserListView(APIView):
    """
    Get all users list (Admin only)
    GET /api/admin/users
    """
    authentication_classes = [CookieAuthentication]
    
    @extend_schema(
        responses={200: {'type': 'object'}}
    )
    def get(self, request):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {'detail': 'Not authenticated'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Check if user is admin
        if not request.user.is_admin:
            return Response(
                {'detail': 'Admin access required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get query parameters
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        user_type = request.query_params.get('user_type')
        rank = request.query_params.get('rank')
        search = request.query_params.get('search')
        
        # Validate page_size
        if page_size < 1:
            page_size = 20
        if page_size > 100:
            page_size = 100
        
        # Build query
        queryset = Member.objects.all()
        
        # Apply filters
        if user_type:
            queryset = queryset.filter(user_type=user_type)
        
        if rank:
            queryset = queryset.filter(rank=rank)
        
        if search:
            queryset = queryset.filter(
                Q(username__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(telegram_id__icontains=search)
            )
        
        # Order by created_at (newest first)
        queryset = queryset.order_by('-created_at')
        
        # Get total count
        total_count = queryset.count()
        
        # Calculate pagination
        start_index = (page - 1) * page_size
        end_index = start_index + page_size
        
        # Get paginated results
        users = queryset[start_index:end_index]
        
        # Serialize data
        results = []
        for user in users:
            results.append({
                'id': user.id,
                'telegram_id': user.telegram_id,
                'username': user.username,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'photo_url': user.photo_url,
                'user_type': user.user_type,
                'rank': user.rank,
                'v_coins_balance': float(user.v_coins_balance),
                'cash_balance': float(user.cash_balance),
                'is_blocked': user.is_blocked,
                'referral_code': user.referral_code,
                'created_at': user.created_at.isoformat()
            })
        
        # Build pagination URLs
        base_url = request.build_absolute_uri(request.path)
        next_url = None
        previous_url = None
        
        if end_index < total_count:
            next_url = f"{base_url}?page={page + 1}&page_size={page_size}"
        
        if page > 1:
            previous_url = f"{base_url}?page={page - 1}&page_size={page_size}"
        
        return Response({
            'count': total_count,
            'next': next_url,
            'previous': previous_url,
            'results': results
        }, status=status.HTTP_200_OK)


class AdminUserDetailView(APIView):
    """
    Get user details (Admin only)
    GET /api/admin/users/{user_id}
    """
    authentication_classes = [CookieAuthentication]
    
    @extend_schema(
        responses={200: AdminUserSerializer}
    )
    def get(self, request, user_id):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {'detail': 'Not authenticated'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Check if user is admin
        if not request.user.is_admin:
            return Response(
                {'detail': 'Admin access required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            user = Member.objects.get(id=user_id)
        except Member.DoesNotExist:
            return Response(
                {'detail': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Calculate statistics
        total_referrals = ReferralRelation.objects.filter(ancestor=user).count()
        total_earnings = Transaction.objects.filter(
            user=user,
            transaction_type__in=['referral_bonus', 'depth_bonus', 'deposit_percent']
        ).aggregate(total=Sum('amount'))['total'] or 0
        
        # Build response
        response_data = {
            'id': user.id,
            'telegram_id': user.telegram_id,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'photo_url': user.photo_url,
            'user_type': user.user_type,
            'rank': user.rank,
            'v_coins_balance': float(user.v_coins_balance),
            'cash_balance': float(user.cash_balance),
            'is_blocked': user.is_blocked,
            'referral_code': user.referral_code,
            'referred_by': None,
            'total_referrals': total_referrals,
            'total_earnings': float(total_earnings),
            'created_at': user.created_at.isoformat(),
            'updated_at': user.created_at.isoformat()
        }
        
        if user.referrer:
            response_data['referred_by'] = {
                'id': user.referrer.id,
                'username': user.referrer.username,
                'first_name': user.referrer.first_name
            }
        
        return Response(response_data, status=status.HTTP_200_OK)


class AdminUserUpdateView(APIView):
    """
    Update user (Admin only)
    PATCH /api/admin/users/{user_id}
    """
    authentication_classes = [CookieAuthentication]
    
    @extend_schema(
        request=AdminUserUpdateSerializer,
        responses={200: {'type': 'object'}}
    )
    def patch(self, request, user_id):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {'detail': 'Not authenticated'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Check if user is admin
        if not request.user.is_admin:
            return Response(
                {'detail': 'Admin access required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            user = Member.objects.get(id=user_id)
        except Member.DoesNotExist:
            return Response(
                {'detail': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = AdminUserUpdateSerializer(user, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(
                {'detail': 'Invalid request data'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer.save()
        user.refresh_from_db()
        
        # Build response
        response_data = {
            'id': user.id,
            'telegram_id': user.telegram_id,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'user_type': user.user_type,
            'rank': user.rank,
            'v_coins_balance': float(user.v_coins_balance),
            'cash_balance': float(user.cash_balance),
            'is_blocked': user.is_blocked,
            'updated_at': timezone.now().isoformat()
        }
        
        return Response(response_data, status=status.HTTP_200_OK)


class AdminTransactionListView(APIView):
    """
    Get all transactions (Admin only)
    GET /api/admin/transactions
    """
    authentication_classes = [CookieAuthentication]
    
    @extend_schema(
        responses={200: {'type': 'object'}}
    )
    def get(self, request):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {'detail': 'Not authenticated'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Check if user is admin
        if not request.user.is_admin:
            return Response(
                {'detail': 'Admin access required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get query parameters
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        user_id = request.query_params.get('user_id')
        transaction_type = request.query_params.get('transaction_type')
        currency = request.query_params.get('currency')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        
        # Validate page_size
        if page_size < 1:
            page_size = 20
        if page_size > 100:
            page_size = 100
        
        # Build query
        queryset = Transaction.objects.all().select_related('user', 'related_user')
        
        # Apply filters
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        if transaction_type:
            queryset = queryset.filter(transaction_type=transaction_type)
        
        if currency:
            # Map currency from API spec to model
            currency_map = {
                'v_coins': 'v_coins',
                'cash': 'cash'
            }
            model_currency = currency_map.get(currency)
            if model_currency:
                queryset = queryset.filter(currency_type=model_currency)
        
        if date_from:
            try:
                date_from_obj = datetime.strptime(date_from, '%Y-%m-%d').date()
                queryset = queryset.filter(created_at__gte=date_from_obj)
            except ValueError:
                pass
        
        if date_to:
            try:
                date_to_obj = datetime.strptime(date_to, '%Y-%m-%d').date()
                date_to_obj = date_to_obj + timedelta(days=1)
                queryset = queryset.filter(created_at__lt=date_to_obj)
            except ValueError:
                pass
        
        # Order by date (newest first)
        queryset = queryset.order_by('-created_at')
        
        # Get total count
        total_count = queryset.count()
        
        # Calculate pagination
        start_index = (page - 1) * page_size
        end_index = start_index + page_size
        
        # Get paginated results
        transactions = queryset[start_index:end_index]
        
        # Serialize data
        results = []
        for trans in transactions:
            results.append({
                'id': trans.id,
                'user': {
                    'id': trans.user.id,
                    'username': trans.user.username,
                    'first_name': trans.user.first_name
                },
                'transaction_type': trans.transaction_type,
                'amount': float(trans.amount),
                'currency': trans.currency_type,
                'description': trans.description,
                'created_at': trans.created_at.isoformat()
            })
        
        # Build pagination URLs
        base_url = request.build_absolute_uri(request.path)
        next_url = None
        previous_url = None
        
        if end_index < total_count:
            next_url = f"{base_url}?page={page + 1}&page_size={page_size}"
        
        if page > 1:
            previous_url = f"{base_url}?page={page - 1}&page_size={page_size}"
        
        return Response({
            'count': total_count,
            'next': next_url,
            'previous': previous_url,
            'results': results
        }, status=status.HTTP_200_OK)


class AdminWithdrawalListView(APIView):
    """
    Get all withdrawal requests (Admin only)
    GET /api/admin/withdrawals
    """
    authentication_classes = [CookieAuthentication]
    
    @extend_schema(
        responses={200: {'type': 'object'}}
    )
    def get(self, request):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {'detail': 'Not authenticated'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Check if user is admin
        if not request.user.is_admin:
            return Response(
                {'detail': 'Admin access required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get query parameters
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        status_filter = request.query_params.get('status')
        user_id = request.query_params.get('user_id')
        
        # Validate page_size
        if page_size < 1:
            page_size = 20
        if page_size > 100:
            page_size = 100
        
        # Build query
        queryset = Withdrawal.objects.all().select_related('user')
        
        # Apply filters
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        # Order by date (newest first)
        queryset = queryset.order_by('-created_at')
        
        # Get total count
        total_count = queryset.count()
        
        # Calculate pagination
        start_index = (page - 1) * page_size
        end_index = start_index + page_size
        
        # Get paginated results
        withdrawals = queryset[start_index:end_index]
        
        # Serialize data
        results = []
        for withdrawal in withdrawals:
            results.append({
                'id': withdrawal.id,
                'user': {
                    'id': withdrawal.user.id,
                    'username': withdrawal.user.username,
                    'first_name': withdrawal.user.first_name,
                    'user_type': withdrawal.user.user_type
                },
                'amount': float(withdrawal.amount),
                'payment_method': withdrawal.method,
                'payment_details': withdrawal.wallet_address,
                'status': withdrawal.status,
                'rejection_reason': withdrawal.rejection_reason,
                'created_at': withdrawal.created_at.isoformat(),
                'updated_at': withdrawal.created_at.isoformat()
            })
        
        # Build pagination URLs
        base_url = request.build_absolute_uri(request.path)
        next_url = None
        previous_url = None
        
        if end_index < total_count:
            next_url = f"{base_url}?page={page + 1}&page_size={page_size}"
        
        if page > 1:
            previous_url = f"{base_url}?page={page - 1}&page_size={page_size}"
        
        return Response({
            'count': total_count,
            'next': next_url,
            'previous': previous_url,
            'results': results
        }, status=status.HTTP_200_OK)


class AdminWithdrawalUpdateView(APIView):
    """
    Update withdrawal request status (Admin only)
    PATCH /api/admin/withdrawals/{id}
    """
    authentication_classes = [CookieAuthentication]
    
    @extend_schema(
        responses={200: {'type': 'object'}}
    )
    def patch(self, request, id):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {'detail': 'Not authenticated'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Check if user is admin
        if not request.user.is_admin:
            return Response(
                {'detail': 'Admin access required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            withdrawal = Withdrawal.objects.get(id=id)
        except Withdrawal.DoesNotExist:
            return Response(
                {'detail': 'Withdrawal not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get status from request
        new_status = request.data.get('status')
        rejection_reason = request.data.get('rejection_reason')
        
        if not new_status:
            return Response(
                {'detail': 'Status is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if new_status not in ['approved', 'rejected']:
            return Response(
                {'detail': 'Status must be approved or rejected'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with db_transaction.atomic():
            # Update withdrawal status
            withdrawal.status = new_status
            withdrawal.processed_at = timezone.now()
            
            if new_status == 'rejected' and rejection_reason:
                withdrawal.rejection_reason = rejection_reason
            
            withdrawal.save()
            
            # If approved, deduct balance
            if new_status == 'approved':
                user = withdrawal.user
                if user.cash_balance >= withdrawal.amount:
                    user.cash_balance -= withdrawal.amount
                    user.save(update_fields=['cash_balance'])
                    
                    # Create transaction record
                    Transaction.objects.create(
                        user=user,
                        amount=withdrawal.amount,
                        currency_type='cash',
                        transaction_type='withdrawal',
                        description=f'Withdrawal to {withdrawal.method}: {withdrawal.wallet_address}'
                    )
                    
                    # Create notification
                    create_notification(
                        user=user,
                        title='Withdrawal Approved',
                        message=f'Your withdrawal request for {withdrawal.amount}₽ has been approved and processed.',
                        notification_type='withdrawal_approved'
                    )
                else:
                    # Insufficient balance, reject the withdrawal
                    withdrawal.status = 'rejected'
                    withdrawal.rejection_reason = 'Insufficient balance'
                    withdrawal.save()
            
            # If rejected, create notification
            if new_status == 'rejected':
                create_notification(
                    user=withdrawal.user,
                    title='Withdrawal Rejected',
                    message=f'Your withdrawal request for {withdrawal.amount}₽ has been rejected. Reason: {rejection_reason or "Not specified"}',
                    notification_type='withdrawal_rejected'
                )
        
        # Build response
        response_data = {
            'id': withdrawal.id,
            'user_id': withdrawal.user.id,
            'amount': float(withdrawal.amount),
            'payment_method': withdrawal.method,
            'payment_details': withdrawal.wallet_address,
            'status': withdrawal.status,
            'rejection_reason': withdrawal.rejection_reason,
            'created_at': withdrawal.created_at.isoformat(),
            'updated_at': withdrawal.processed_at.isoformat() if withdrawal.processed_at else withdrawal.created_at.isoformat()
        }
        
        return Response(response_data, status=status.HTTP_200_OK)


class AdminStatsView(APIView):
    """
    Get system statistics (Admin only)
    GET /api/admin/stats
    """
    authentication_classes = [CookieAuthentication]
    
    @extend_schema(
        responses={200: AdminStatsSerializer}
    )
    def get(self, request):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {'detail': 'Not authenticated'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Check if user is admin
        if not request.user.is_admin:
            return Response(
                {'detail': 'Admin access required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Calculate statistics
        total_users = Member.objects.count()
        total_players = Member.objects.filter(user_type='player').count()
        total_influencers = Member.objects.filter(user_type='influencer').count()
        
        total_v_coins = Member.objects.aggregate(
            total=Sum('v_coins_balance')
        )['total'] or 0
        
        total_cash_payouts = Transaction.objects.filter(
            transaction_type='withdrawal'
        ).aggregate(total=Sum('amount'))['total'] or 0
        
        total_transactions = Transaction.objects.count()
        
        pending_withdrawals = Withdrawal.objects.filter(status='pending').count()
        pending_withdrawals_amount = Withdrawal.objects.filter(
            status='pending'
        ).aggregate(total=Sum('amount'))['total'] or 0
        
        stats = {
            'total_users': total_users,
            'total_players': total_players,
            'total_influencers': total_influencers,
            'total_v_coins': float(total_v_coins),
            'total_cash_payouts': float(total_cash_payouts),
            'total_transactions': total_transactions,
            'pending_withdrawals': pending_withdrawals,
            'pending_withdrawals_amount': float(pending_withdrawals_amount)
        }
        
        return Response(stats, status=status.HTTP_200_OK)


class AdminAnalyticsView(APIView):
    """
    Get system analytics (Admin only)
    GET /api/admin/analytics
    """
    authentication_classes = [CookieAuthentication]
    
    @extend_schema(
        responses={200: AdminAnalyticsSerializer}
    )
    def get(self, request):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {'detail': 'Not authenticated'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Check if user is admin
        if not request.user.is_admin:
            return Response(
                {'detail': 'Admin access required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get period parameter
        period = request.query_params.get('period', '30days')
        
        # Calculate date range
        now = timezone.now()
        if period == '7days':
            start_date = now - timedelta(days=7)
        elif period == '90days':
            start_date = now - timedelta(days=90)
        elif period == '1year':
            start_date = now - timedelta(days=365)
        else:  # default 30days
            start_date = now - timedelta(days=30)
        
        # Registrations by day
        registrations_by_day = []
        for i in range((now.date() - start_date.date()).days + 1):
            date = start_date.date() + timedelta(days=i)
            count = Member.objects.filter(
                created_at__date=date
            ).count()
            registrations_by_day.append({
                'date': date.isoformat(),
                'count': count
            })
        
        # Activity by day (transactions)
        activity_by_day = []
        for i in range((now.date() - start_date.date()).days + 1):
            date = start_date.date() + timedelta(days=i)
            transactions = Transaction.objects.filter(
                created_at__date=date
            )
            activity_by_day.append({
                'date': date.isoformat(),
                'transactions_count': transactions.count(),
                'total_amount': float(transactions.aggregate(total=Sum('amount'))['total'] or 0)
            })
        
        # Top referrers
        top_referrers = []
        referrers = Member.objects.annotate(
            referrals_count=Count('descendant_relations')
        ).filter(referrals_count__gt=0).order_by('-referrals_count')[:10]
        
        for referrer in referrers:
            total_earnings = Transaction.objects.filter(
                user=referrer,
                transaction_type__in=['referral_bonus', 'depth_bonus', 'deposit_percent']
            ).aggregate(total=Sum('amount'))['total'] or 0
            
            top_referrers.append({
                'user_id': referrer.id,
                'username': referrer.username,
                'first_name': referrer.first_name,
                'user_type': referrer.user_type,
                'referrals_count': referrer.referrals_count,
                'total_earnings': float(total_earnings)
            })
        
        analytics = {
            'registrations_by_day': registrations_by_day,
            'activity_by_day': activity_by_day,
            'top_referrers': top_referrers
        }
        
        return Response(analytics, status=status.HTTP_200_OK)


class HelloView(APIView):
    """
    A simple API endpoint that returns a greeting message.
    """

    @extend_schema(
        responses={200: MessageSerializer}, description="Get a hello world message"
    )
    def get(self, request):
        data = {"message": "Hello!", "timestamp": timezone.now()}
        serializer = MessageSerializer(data)
        return Response(serializer.data)