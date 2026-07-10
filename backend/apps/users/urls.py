from django.urls import path
from .views import (
    CadastroView, MeView, PerfilView,
    SelecionarBadgeDestaqueView, ConfiguracoesView,
)

urlpatterns = [
    path('cadastro/', CadastroView.as_view(), name='cadastro'),
    path('me/', MeView.as_view(), name='me'),
    path('me/badge-destaque/', SelecionarBadgeDestaqueView.as_view(), name='selecionar-badge-destaque'),
    path('me/configuracoes/', ConfiguracoesView.as_view(), name='configuracoes'),
    path('<str:username>/', PerfilView.as_view(), name='perfil'),
]