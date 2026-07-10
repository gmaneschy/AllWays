from rest_framework import generics, permissions
from .models import BadgeItinerario, UsuarioBadge
from .serializers import BadgeItinerarioSerializer, MinhaConquistaSerializer


class BadgeItinerarioListView(generics.ListAPIView):
    """GET /api/gamification/badges-itinerario/
    Catálogo completo de badges de itinerário — usado na tela de criação do post."""
    queryset = BadgeItinerario.objects.all()
    serializer_class = BadgeItinerarioSerializer
    permission_classes = [permissions.AllowAny]


class MinhasConquistasView(generics.ListAPIView):
    """GET /api/gamification/minhas-conquistas/
    Lista as badges de usuário já conquistadas pelo usuário logado —
    alimenta o modal de seleção de badge_destaque."""
    serializer_class = MinhaConquistaSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return UsuarioBadge.objects.filter(
            usuario=self.request.user
        ).select_related('badge', 'badge__tipo').order_by('badge__tipo__nome', 'badge__criterio_valor')