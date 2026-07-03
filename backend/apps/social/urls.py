from django.urls import path
from .views import (
    FollowToggleView, SeguidoresUsuarioView, SeguindoUsuarioView, StatusFollowView,
    ConversasView, MensagensConversaView, UsuariosParaMensagemView,
    BuscaView, ExplorarView,
)

urlpatterns = [
    # Follow
    path('follow/', FollowToggleView.as_view(), name='follow-toggle'),
    path('follow/status/', StatusFollowView.as_view(), name='follow-status'),
    path('usuarios/<str:username>/seguidores/', SeguidoresUsuarioView.as_view(), name='seguidores'),
    path('usuarios/<str:username>/seguindo/', SeguindoUsuarioView.as_view(), name='seguindo'),

    # Mensagens
    path('mensagens/', ConversasView.as_view(), name='conversas'),
    path('mensagens/destinatarios/', UsuariosParaMensagemView.as_view(), name='destinatarios'),
    path('mensagens/<str:username>/', MensagensConversaView.as_view(), name='conversa'),

    # Busca e explorar
    path('busca/', BuscaView.as_view(), name='busca'),
    path('explorar/', ExplorarView.as_view(), name='explorar'),
]