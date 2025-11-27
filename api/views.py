from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.utils import timezone
from django.contrib.sessions.models import Session
from drf_spectacular.utils import extend_schema
import hashlib
import hmac
import secrets

from .serializers import (
    MessageSerializer,
    TelegramAuthSerializer,
    MemberSerializer,
    MemberStatsSerializer,
    MemberUpdateSerializer
)
from .models import Member, Transaction


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
        ).aggregate(total=models.Sum('amount'))['total'] or 0
        
        stats = {
            'user_id': user.id,
            'balance': balance,
            'rank': user.rank,
            'referral_count': referral_count,
            'total_earnings': total_earnings
        }
        
        serializer = MemberStatsSerializer(stats)
        return Response(serializer.data, status=status.HTTP_200_OK)


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
