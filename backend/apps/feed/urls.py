from django.urls import path
from .views import FeedPrincipalView

urlpatterns = [
    path('principal/', FeedPrincipalView.as_view(), name='feed-principal'),
]