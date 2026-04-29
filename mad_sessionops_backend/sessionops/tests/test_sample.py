"""
Sample test file demonstrating testing best practices.

Following Dalgo backend testing patterns.
"""

import pytest
from django.test import TestCase
from django.contrib.auth.models import User


class UserTestCase(TestCase):
    """Test case for User model"""

    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )

    def test_user_creation(self):
        """Test that user is created successfully"""
        self.assertEqual(self.user.username, "testuser")
        self.assertEqual(self.user.email, "test@example.com")
        self.assertTrue(self.user.check_password("testpass123"))

    def test_user_str(self):
        """Test user string representation"""
        self.assertEqual(str(self.user), "testuser")


@pytest.mark.django_db
def test_user_creation_pytest():
    """Test user creation using pytest"""
    user = User.objects.create_user(
        username="pytestuser",
        email="pytest@example.com",
        password="pytestpass123"
    )
    assert user.username == "pytestuser"
    assert user.email == "pytest@example.com"
    assert user.check_password("pytestpass123")

