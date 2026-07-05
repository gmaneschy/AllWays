from django.urls import path
from .views import FeedPrincipalView, FeedEventView, FeedStatusView

urlpatterns = [
    path('principal/', FeedPrincipalView.as_view(), name='feed-principal'),
    path('evento/', FeedEventView.as_view(), name='feed-evento'),
    path('status/', FeedStatusView.as_view(), name='feed-status'),
]