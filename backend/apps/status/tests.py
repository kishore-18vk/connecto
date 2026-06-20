from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apps.status.models import Status
from apps.status.tasks import expire_status_updates
from django.utils import timezone
from datetime import timedelta

User = get_user_model()

class StatusTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='story_teller', email='story@example.com', password='password123', first_name='Story'
        )
        self.viewer = User.objects.create_user(
            username='viewer', email='viewer@example.com', password='password123', first_name='Viewer'
        )
        self.client.force_authenticate(user=self.user)

    def test_status_creation_api(self):
        """Test creating a text-based status update"""
        url = '/api/status/'
        data = {
            'media_type': 'TEXT',
            'text_content': 'Life is beautiful!',
            'background_color': '#e91e63'
        }
        res = self.client.post(url, data, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['text_content'], 'Life is beautiful!')
        self.assertEqual(res.data['media_type'], 'TEXT')

    def test_status_views_count(self):
        """Test logging views on a status item"""
        status_item = Status.objects.create(
            user=self.user,
            media_type='TEXT',
            text_content='View this!',
            background_color='#000000'
        )
        
        # Add creator to viewer's contacts to satisfy privacy queryset filters
        from apps.contacts.models import Contact
        Contact.objects.create(user=self.viewer, contact=self.user)
        
        # Authenticate as a different viewer user
        self.client.force_authenticate(user=self.viewer)
        url = f'/api/status/{status_item.id}/view/'
        res = self.client.post(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # Check views count
        self.assertEqual(status_item.views.count(), 1)

    def test_status_expiration_task(self):
        """Test background status deletion task (older than 24 hours)"""
        # Create fresh status
        s1 = Status.objects.create(
            user=self.user, media_type='TEXT', text_content='Fresh Status'
        )
        # Create expired status
        s2 = Status.objects.create(
            user=self.user, media_type='TEXT', text_content='Expired Status'
        )
        # Override created_at to 25 hours ago
        Status.objects.filter(id=s2.id).update(created_at=timezone.now() - timedelta(hours=25))

        # Run background expiry Celery task
        expire_status_updates()

        self.assertTrue(Status.objects.filter(id=s1.id).exists())
        self.assertFalse(Status.objects.filter(id=s2.id).exists())
