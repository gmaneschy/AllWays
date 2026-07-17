from django.urls import path
from .views import (
    FollowToggleView, SeguidoresUsuarioView, SeguindoUsuarioView, StatusFollowView,
    ComentariosItinerarioView, HashtagFeedView,
    ConversasView, MensagensConversaView, UsuariosParaMensagemView,
    BuscaView, ExplorarView, CurtidaToggleView,
    NotificacoesView, NotificacoesNaoLidasView,
    MarcarNotificacaoLidaView, MarcarTodasNotificacoesLidasView,
)

urlpatterns = [
    # Follow
    path('follow/', FollowToggleView.as_view(), name='follow-toggle'),
    path('follow/status/', StatusFollowView.as_view(), name='follow-status'),
    path('usuarios/<str:username>/seguidores/', SeguidoresUsuarioView.as_view(), name='seguidores'),
    path('usuarios/<str:username>/seguindo/', SeguindoUsuarioView.as_view(), name='seguindo'),

    # Curtidas
    path('curtida/', CurtidaToggleView.as_view(), name='curtida-toggle'),

    # Comentários sociais
    path('itinerarios/<int:itinerario_id>/comentarios/', ComentariosItinerarioView.as_view(), name='comentarios'),

    # Hashtag feed
    path('hashtag/<str:nome>/', HashtagFeedView.as_view(), name='hashtag-feed'),

    # Mensagens
    path('mensagens/', ConversasView.as_view(), name='conversas'),
    path('mensagens/destinatarios/', UsuariosParaMensagemView.as_view(), name='destinatarios'),
    path('mensagens/<str:username>/', MensagensConversaView.as_view(), name='conversa'),

    # Busca e explorar
    path('busca/', BuscaView.as_view(), name='busca'),
    path('explorar/', ExplorarView.as_view(), name='explorar'),

    # Notificações
    path('notificacoes/', NotificacoesView.as_view(), name='notificacoes'),
    path('notificacoes/nao-lidas/', NotificacoesNaoLidasView.as_view(), name='notificacoes-nao-lidas'),
    path('notificacoes/marcar-todas-lidas/', MarcarTodasNotificacoesLidasView.as_view(), name='notificacoes-marcar-todas'),
    path('notificacoes/<int:pk>/lida/', MarcarNotificacaoLidaView.as_view(), name='notificacao-marcar-lida'),
]