from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()

class AuthenticationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.register_url = '/api/auth/google/'
        self.logout_url = '/api/auth/logout/'
        self.logout_all_url = '/api/auth/logout/all/'

    def test_user_creation_and_profile_signal(self):
        """Test that creating a user automatically triggers profile creation"""
        user = User.objects.create_user(
            username='john_doe',
            email='john@example.com',
            password='securepassword123',
            first_name='John',
            last_name='Doe'
        )
        self.assertEqual(user.first_name, 'John')
        self.assertIsNotNone(user.profile)
        self.assertEqual(user.profile.bio, "Hey there! I am using WhatsApp.")

    def test_mock_login_authentication(self):
        """Test registering/logging in via mock OAuth endpoint"""
        data = {
            'email': 'alice@example.com',
            'name': 'Alice Smith',
            'avatar_url': 'http://example.com/avatar.jpg',
            'google_id': 'g_alice_123'
        }
        res = self.client.post(self.register_url, data, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data)
        self.assertIn('refresh', res.data)
        self.assertIn('user', res.data)
        self.assertEqual(res.data['user']['email'], 'alice@example.com')
        self.assertEqual(res.data['user']['nickname'], 'Alice Smith')
        self.assertEqual(res.data['user']['google_id'], 'g_alice_123')
        self.assertTrue(res.data['user']['username'].startswith('alice'))

    def test_email_privacy_redaction(self):
        """Test that user email is redacted/hidden based on privacy_email visibility rules"""
        user_a = User.objects.create_user(
            username='user_a',
            email='usera@example.com',
            nickname='User A'
        )
        user_a.profile.privacy_email = 'PRIVATE'
        user_a.profile.save()

        user_b = User.objects.create_user(
            username='user_b',
            email='userb@example.com',
            nickname='User B'
        )
        user_b.profile.privacy_email = 'FRIENDS'
        user_b.profile.save()

        user_c = User.objects.create_user(
            username='user_c',
            email='userc@example.com',
            nickname='User C'
        )
        user_c.profile.privacy_email = 'PUBLIC'
        user_c.profile.save()

        user_d = User.objects.create_user(
            username='user_d',
            email='userd@example.com',
            nickname='User D'
        )

        # Force authentication of request context
        self.client.force_authenticate(user=user_d)

        from apps.accounts.serializers import UserSerializer
        
        # Mock Request
        from django.test import RequestFactory
        factory = RequestFactory()
        django_req = factory.get('/')
        django_req.user = user_d

        # 1. User A is Private -> email should be empty string
        serializer_a = UserSerializer(user_a, context={'request': django_req})
        self.assertEqual(serializer_a.data['email'], '')

        # 2. User B is Friends Only, User D is NOT in contacts -> email should be empty
        serializer_b = UserSerializer(user_b, context={'request': django_req})
        self.assertEqual(serializer_b.data['email'], '')

        # 3. Add User D to User B's contacts
        from apps.contacts.models import Contact
        Contact.objects.create(user=user_b, contact=user_d)
        
        # Now User B is Friends Only, User D is a contact -> email should show
        serializer_b2 = UserSerializer(user_b, context={'request': django_req})
        self.assertEqual(serializer_b2.data['email'], 'userb@example.com')

        # 4. User C is Public -> email should show
        serializer_c = UserSerializer(user_c, context={'request': django_req})
        self.assertEqual(serializer_c.data['email'], 'userc@example.com')

        # 5. User A views their own profile -> email should show
        django_req_self = factory.get('/')
        django_req_self.user = user_a
        serializer_own = UserSerializer(user_a, context={'request': django_req_self})
        self.assertEqual(serializer_own.data['email'], 'usera@example.com')

    def test_global_logout_device_invalidation(self):
        """Test that logout all changes user password and invalidates tokens"""
        user = User.objects.create_user(
            username='logout_test',
            email='test@example.com',
            password='oldpassword'
        )
        old_password_hash = user.password
        self.client.force_authenticate(user=user)
        
        # Call global logout
        res = self.client.post(self.logout_all_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        
        # User password must change
        user.refresh_from_db()
        self.assertNotEqual(user.password, old_password_hash)

    def test_email_password_registration(self):
        """Test registering a new user with email and password using OTP"""
        # 1. Send OTP
        send_res = self.client.post('/api/auth/send-otp/', {'email': 'newuser@example.com'}, format='json')
        self.assertEqual(send_res.status_code, status.HTTP_200_OK)
        from apps.authentication.models import EmailOTP
        otp_code = EmailOTP.objects.get(email='newuser@example.com').otp
        self.assertIsNotNone(otp_code)

        # 2. Register with OTP
        data = {
            'email': 'newuser@example.com',
            'nickname': 'New User Nick',
            'password': 'StrongPassword123!',
            'otp': otp_code
        }
        res = self.client.post('/api/auth/register/', data, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn('access', res.data)
        self.assertIn('refresh', res.data)
        self.assertEqual(res.data['user']['email'], 'newuser@example.com')
        self.assertEqual(res.data['user']['nickname'], 'New User Nick')
        
        # Verify the user has a hashed password in db
        user = User.objects.get(email='newuser@example.com')
        self.assertTrue(user.check_password('StrongPassword123!'))

    def test_otp_verification_failure(self):
        """Test that registration fails with invalid or expired OTP"""
        # Send OTP
        self.client.post('/api/auth/send-otp/', {'email': 'badotp@example.com'}, format='json')
        
        # Register with bad OTP
        data = {
            'email': 'badotp@example.com',
            'nickname': 'Bad OTP Nick',
            'password': 'StrongPassword123!',
            'otp': '000000'
        }
        res = self.client.post('/api/auth/register/', data, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Invalid verification code', res.data['detail'])

    def test_email_password_login(self):
        """Test logging in with email and password credentials"""
        user = User.objects.create_user(
            username='logintest',
            email='logintest@example.com',
            nickname='Login Nick'
        )
        user.set_password('SecretPass321')
        user.save()

        # Login with correct credentials
        login_data = {
            'email': 'logintest@example.com',
            'password': 'SecretPass321'
        }
        res = self.client.post('/api/auth/login/', login_data, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data)
        self.assertEqual(res.data['user']['email'], 'logintest@example.com')

        # Login with incorrect password
        bad_data = {
            'email': 'logintest@example.com',
            'password': 'WrongPassword'
        }
        res_bad = self.client.post('/api/auth/login/', bad_data, format='json')
        self.assertEqual(res_bad.status_code, status.HTTP_401_UNAUTHORIZED)
