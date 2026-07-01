from django.shortcuts import render
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from apps.itineraries.models import ItinerarioSalvo, ItinerarioBaixado, Itinerario
from .models import User
from .serializers import (
    CadastroSerializer, MeSerializer,
    PerfilPublicoSerializer, PerfilProprioSerializer
)

# Create your views here.

class CadastroView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = CadastroSerializer
    permission_classes = [permissions.AllowAny]

class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = MeSerializer(request.user)
        return Response(serializer.data)


class PerfilView(APIView):
    """GET /api/users/<username>/
    Retorna perfil público ou próprio dependendo de quem está logado."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, username):
        usuario = get_object_or_404(User, username=username)

        if request.user.is_authenticated and request.user == usuario:
            serializer = PerfilProprioSerializer(usuario, context={'request': request})
        else:
            serializer = PerfilPublicoSerializer(usuario, context={'request': request})

        return Response(serializer.data)


class SalvarItinerarioView(APIView):
    """POST /api/itineraries/<id>/salvar/ — toggle: salva ou dessalva."""
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
    """POST /api/itineraries/<id>/baixar/ — registra o download."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        itinerario = get_object_or_404(Itinerario, pk=pk, status='publicado')
        ItinerarioBaixado.objects.get_or_create(
            usuario=request.user, itinerario=itinerario
        )
        # Salva automaticamente ao baixar (hierarquia: todo baixado é salvo)
        ItinerarioSalvo.objects.get_or_create(
            usuario=request.user, itinerario=itinerario
        )
        return Response({'baixado': True})