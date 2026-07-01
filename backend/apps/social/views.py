from django.shortcuts import get_object_or_404
from django.db.models import Q
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from apps.users.models import User
from apps.places.models import Place
from apps.itineraries.models import Itinerario
from .models import Follow, Hashtag, Message
from .serializers import (
    FollowSerializer, UsuarioResumoSerializer, HashtagSerializer,
    MessageSerializer,
)


class FollowToggleView(APIView):
    """POST /api/social/follow/
    Body: {"tipo": "usuario"|"local"|"hashtag", "alvo_id": <int>}
    Toggle: cria o Follow se não existir, remove se já existir."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = FollowSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

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
    """GET /api/social/follow/status/?tipo=usuario&alvo_id=5"""
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


# ─── Mensagens ────────────────────────────────────────────────────────────────

class ConversasView(APIView):
    """GET /api/social/mensagens/
    Retorna a lista de conversas do usuário logado: um item por interlocutor,
    com a última mensagem trocada e o total de mensagens não lidas."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user

        # IDs únicos de todos os interlocutores (quem me mandou OU eu mandei)
        enviadas = Message.objects.filter(remetente=user).values_list('destinatario_id', flat=True)
        recebidas = Message.objects.filter(destinatario=user).values_list('remetente_id', flat=True)
        interlocutores_ids = set(enviadas) | set(recebidas)

        conversas = []
        for uid in interlocutores_ids:
            interlocutor = User.objects.get(pk=uid)
            ultima = (
                Message.objects
                .filter(
                    Q(remetente=user, destinatario_id=uid) |
                    Q(remetente_id=uid, destinatario=user)
                )
                .order_by('-enviada_em')
                .first()
            )
            conversas.append({
                'usuario': {
                    'id': interlocutor.id,
                    'username': interlocutor.username,
                    'foto_perfil': request.build_absolute_uri(interlocutor.foto_perfil.url)
                                   if interlocutor.foto_perfil else None,
                },
                'ultima_mensagem': {
                    'texto': ultima.texto,
                    'enviada_em': ultima.enviada_em,
                    'minha': ultima.remetente_id == user.id,
                },
            })

        # Ordena por data da última mensagem (mais recente primeiro)
        conversas.sort(key=lambda c: c['ultima_mensagem']['enviada_em'], reverse=True)
        return Response(conversas)


class MensagensConversaView(APIView):
    """GET  /api/social/mensagens/<username>/  — histórico da conversa
    POST /api/social/mensagens/<username>/  — envia nova mensagem"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, username):
        outro = get_object_or_404(User, username=username)
        mensagens = (
            Message.objects
            .filter(
                Q(remetente=request.user, destinatario=outro) |
                Q(remetente=outro, destinatario=request.user)
            )
            .order_by('enviada_em')
        )
        serializer = MessageSerializer(mensagens, many=True)
        return Response(serializer.data)

    def post(self, request, username):
        outro = get_object_or_404(User, username=username)
        if outro == request.user:
            return Response(
                {'erro': 'Você não pode enviar mensagens para si mesmo.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = MessageSerializer(data={'destinatario': outro.id, 'texto': request.data.get('texto', '')})
        serializer.is_valid(raise_exception=True)
        serializer.save(remetente=request.user, destinatario=outro)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


# ─── Busca unificada ──────────────────────────────────────────────────────────

class BuscaView(APIView):
    """GET /api/social/busca/?q=termo
    Retorna usuários, lugares e hashtags que batem com o termo,
    agrupados em seções separadas."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        q = request.query_params.get('q', '').strip()
        if not q:
            return Response({'usuarios': [], 'lugares': [], 'hashtags': []})

        usuarios = User.objects.filter(username__icontains=q)[:8]
        lugares = Place.objects.filter(nome__icontains=q)[:8]
        hashtags = Hashtag.objects.filter(nome__icontains=q)[:8]

        return Response({
            'usuarios': [
                {'id': u.id, 'username': u.username,
                 'foto_perfil': request.build_absolute_uri(u.foto_perfil.url) if u.foto_perfil else None}
                for u in usuarios
            ],
            'lugares': [
                {'id': p.id, 'nome': p.nome, 'endereco': p.endereco,
                 'foto_capa': request.build_absolute_uri(p.foto_capa.url) if getattr(p, 'foto_capa', None) and p.foto_capa else None}
                for p in lugares
            ],
            'hashtags': [
                {'id': h.id, 'nome': h.nome, 'total_seguidores': h.seguidores.count()}
                for h in hashtags
            ],
        })


# ─── Explorar ─────────────────────────────────────────────────────────────────

class ExplorarView(APIView):
    """GET /api/social/explorar/
    Feed cronológico de itinerários publicados para a página Explorar.
    Algoritmo de recomendação será implementado futuramente."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        itinerarios = (
            Itinerario.objects
            .filter(status='publicado')
            .select_related('autor')
            .prefetch_related('pontos__local')
            .order_by('-publicado_em')[:40]
        )

        resultado = []
        for it in itinerarios:
            primeiro_ponto = it.pontos.first()
            resultado.append({
                'id': it.id,
                'titulo': it.titulo,
                'tipo': it.tipo,
                'publicado_em': it.publicado_em,
                'autor': {
                    'username': it.autor.username if it.autor else None,
                    'foto_perfil': request.build_absolute_uri(it.autor.foto_perfil.url)
                                   if it.autor and it.autor.foto_perfil else None,
                },
                'lugar_principal': {
                    'nome': primeiro_ponto.local.nome if primeiro_ponto else None,
                } if primeiro_ponto else None,
                'total_pontos': it.pontos.count(),
            })

        return Response(resultado)