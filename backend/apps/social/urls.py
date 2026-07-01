from django.urls import path
from .views import (
    FollowToggleView, SeguidoresUsuarioView, SeguindoUsuarioView, StatusFollowView
)

urlpatterns = [
    path('follow/', FollowToggleView.as_view(), name='follow-toggle'),
    path('follow/status/', StatusFollowView.as_view(), name='follow-status'),
    path('usuarios/<str:username>/seguidores/', SeguidoresUsuarioView.as_view(), name='seguidores'),
    path('usuarios/<str:username>/seguindo/', SeguindoUsuarioView.as_view(), name='seguindo'),
]