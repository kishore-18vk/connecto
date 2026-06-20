from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apps.chats.models import Chat, Message

User = get_user_model()

class ChatsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(
            username='user1', email='user1@example.com', password='password123', first_name='User', last_name='One'
        )
        self.user2 = User.objects.create_user(
            username='user2', email='user2@example.com', password='password123', first_name='User', last_name='Two'
        )
        self.client.force_authenticate(user=self.user1)

    def test_create_chat_session(self):
        """Test generating a Direct Message (DM) chat session"""
        url = '/api/chats/'
        data = {
            'type': 'DM',
            'participants': [self.user2.id]
        }
        res = self.client.post(url, data, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['type'], 'DM')
        self.assertEqual(len(res.data['participants']), 2)

    def test_message_reaction_api(self):
        """Test toggle reaction on a message"""
        chat = Chat.objects.create(type='DM')
        chat.participants.add(self.user1, self.user2)
        message = Message.objects.create(
            chat=chat,
            sender=self.user1,
            content='Hello there!',
            message_type='TEXT'
        )
        
        url = f'/api/chats/messages/{message.id}/react/'
        res = self.client.post(url, {'emoji': '👍'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data['reactions']), 1)
        self.assertEqual(res.data['reactions'][0]['emoji'], '👍')

    def test_message_star_api(self):
        """Test toggle star on a message"""
        chat = Chat.objects.create(type='DM')
        chat.participants.add(self.user1, self.user2)
        message = Message.objects.create(
            chat=chat,
            sender=self.user1,
            content='Starred message!',
            message_type='TEXT'
        )
        
        url = f'/api/chats/messages/{message.id}/star/'
        res = self.client.post(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data['is_starred'])

        # Toggle again
        res = self.client.post(url)
        self.assertFalse(res.data['is_starred'])
