from django.urls import path
from .views import CadastroView, MeView, PerfilView

urlpatterns = [
    path('cadastro/', CadastroView.as_view(), name='cadastro'),
    path('me/', MeView.as_view(), name='me'),
    path('<str:username>/', PerfilView.as_view(), name='perfil'),
]