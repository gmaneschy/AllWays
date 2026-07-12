from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.views import APIView
from rest_framework.response import Response
from apps.itineraries.models import ItinerarioSalvo, ItinerarioBaixado, Itinerario
from .models import User
from .serializers import (
    CadastroSerializer, MeSerializer, ConfiguracoesSerializer,
    PerfilPublicoSerializer, PerfilProprioSerializer,
    SelecionarBadgeDestaqueSerializer, EditarPerfilSerializer,
)


class CadastroView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = CadastroSerializer
    permission_classes = [permissions.AllowAny]


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = MeSerializer(request.user, context={'request': request})
        return Response(serializer.data)


class EditarPerfilView(APIView):
    """PATCH /api/users/me/perfil/
    Edição de nome_exibicao (respeitando cooldown de 15 dias), bio e
    foto_perfil. Badge tem endpoint próprio."""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def patch(self, request):
        serializer = EditarPerfilSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(MeSerializer(request.user, context={'request': request}).data)


class ConfiguracoesView(APIView):
    """GET/PATCH /api/users/me/configuracoes/
    Preferências de conta. Hoje só 'exibir_badges', mas o endpoint fica
    genérico pra receber outras configurações futuras sem quebrar o contrato."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(ConfiguracoesSerializer(request.user).data)

    def patch(self, request):
        serializer = ConfiguracoesSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class SelecionarBadgeDestaqueView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request):
        serializer = SelecionarBadgeDestaqueSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        request.user.badge_destaque_id = serializer.validated_data['badge_id']
        request.user.save(update_fields=['badge_destaque'])

        return Response(MeSerializer(request.user, context={'request': request}).data)


class PerfilView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, username):
        usuario = get_object_or_404(User, username=username)

        if request.user.is_authenticated and request.user == usuario:
            serializer = PerfilProprioSerializer(usuario, context={'request': request})
        else:
            serializer = PerfilPublicoSerializer(usuario, context={'request': request})

        return Response(serializer.data)


class SalvarItinerarioView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        itinerario = get_object_or_404(Itinerario, pk=pk, status='publicado')
        salvo, criado = ItinerarioSalvo.objects.get_or_create(
            usuario=request.user, itinerario=itinerario
        )
        if not criado:
            salvo.delete()
            return Response({'salvo': False})
        return Response({'salvo': True}, status=status.HTTP_201_CREATED)


class BaixarItinerarioView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        itinerario = get_object_or_404(Itinerario, pk=pk, status='publicado')
        ItinerarioBaixado.objects.get_or_create(usuario=request.user, itinerario=itinerario)
        ItinerarioSalvo.objects.get_or_create(usuario=request.user, itinerario=itinerario)
        return Response({'baixado': True})