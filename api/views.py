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
    MemberSerializer,
    MemberStatsSerializer,
    MemberUpdateSerializer,
    UserRegisterSerializer,
    ReferralSerializer,
    ReferralTreeSerializer,
    TransactionSerializer,
    TransactionFilterSerializer
)
from .models import Member, Transaction, ReferralRelation, Notification

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
            notification_type='rank_up'
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


def create_notification(user, title, message, notification_type):
    """
    Create notification for user
    
    Args:
        user: Member instance
        title: Notification title
        message: Notification message
        notification_type: Type of notification (bonus, rank_up, withdrawal, system)
    
    Returns:
        Notification instance
    """
    return Notification.objects.create(
        user=user,
        title=title,
        message=message,
        notification_type=notification_type
    )


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


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
        session_token = self.create_session(user)
        
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
    
    def create_session(self, user):
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
                    notification_type='bonus'
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
                        notification_type='bonus'
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
                            notification_type='bonus'
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
                        notification_type='bonus'
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
