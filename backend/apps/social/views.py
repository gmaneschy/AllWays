from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from apps.users.models import User
from apps.places.models import Place
from .models import Follow, Hashtag
from .serializers import FollowSerializer, UsuarioResumoSerializer, HashtagSerializer


class FollowToggleView(APIView):
    """POST /api/social/follow/
    Body: {"tipo": "usuario"|"local"|"hashtag", "alvo_id": <int>}
    Toggle: cria o Follow se não existir, remove se já existir."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = FollowSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        # Verifica se já existe um follow igual antes de criar, para implementar o toggle
        filtro = {'seguidor': request.user}
        if 'seguido_usuario' in serializer.validated_data:
            filtro['seguido_usuario'] = serializer.validated_data['seguido_usuario']
        elif 'seguido_local' in serializer.validated_data:
            filtro['seguido_local'] = serializer.validated_data['seguido_local']
        else:
            filtro['seguido_hashtag'] = serializer.validated_data['seguido_hashtag']

        existente = Follow.objects.filter(**filtro).first()
        if existente:
            existente.delete()
            return Response({'seguindo': False})

        serializer.save()
        return Response({'seguindo': True}, status=status.HTTP_201_CREATED)


class SeguidoresUsuarioView(generics.ListAPIView):
    """GET /api/social/usuarios/<username>/seguidores/"""
    serializer_class = UsuarioResumoSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        usuario = get_object_or_404(User, username=self.kwargs['username'])
        return User.objects.filter(seguindo__seguido_usuario=usuario)


class SeguindoUsuarioView(generics.ListAPIView):
    """GET /api/social/usuarios/<username>/seguindo/"""
    serializer_class = UsuarioResumoSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        usuario = get_object_or_404(User, username=self.kwargs['username'])
        return User.objects.filter(seguidores__seguidor=usuario)


class StatusFollowView(APIView):
    """GET /api/social/follow/status/?tipo=usuario&alvo_id=5
    Retorna se o usuário logado já segue o alvo — usado para decidir
    se mostra botão 'Seguir' ou 'Deixar de seguir'."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        tipo = request.query_params.get('tipo')
        alvo_id = request.query_params.get('alvo_id')

        filtro = {'seguidor': request.user}
        if tipo == 'usuario':
            filtro['seguido_usuario_id'] = alvo_id
        elif tipo == 'local':
            filtro['seguido_local_id'] = alvo_id
        elif tipo == 'hashtag':
            filtro['seguido_hashtag_id'] = alvo_id
        else:
            return Response({'erro': 'tipo inválido'}, status=status.HTTP_400_BAD_REQUEST)

        seguindo = Follow.objects.filter(**filtro).exists()
        return Response({'seguindo': seguindo})