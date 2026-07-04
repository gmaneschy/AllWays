from django.shortcuts import get_object_or_404
from django.db.models import Q, Case, When, Value, IntegerField
from rest_framework import generics, permissions, status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.views import APIView
from rest_framework.response import Response
from apps.users.models import User
from apps.places.models import Place
from apps.itineraries.models import Itinerario
from .models import Follow, Hashtag, Message, Comment
from .serializers import (
    FollowSerializer, UsuarioResumoSerializer, HashtagSerializer,
    MessageSerializer, CommentSerializer,
)


# ─── Follow ───────────────────────────────────────────────────────────────────

class FollowToggleView(APIView):
    """POST /api/social/follow/
    Body: {"tipo": "usuario"|"local", "alvo_id": <int>}
    Toggle: cria se não existir, remove se já existir."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = FollowSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        filtro = {'seguidor': request.user}
        if 'seguido_usuario' in serializer.validated_data:
            filtro['seguido_usuario'] = serializer.validated_data['seguido_usuario']
        else:
            filtro['seguido_local'] = serializer.validated_data['seguido_local']

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
    """GET /api/social/follow/status/?tipo=usuario|local&alvo_id=5"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        tipo = request.query_params.get('tipo')
        alvo_id = request.query_params.get('alvo_id')

        filtro = {'seguidor': request.user}
        if tipo == 'usuario':
            filtro['seguido_usuario_id'] = alvo_id
        elif tipo == 'local':
            filtro['seguido_local_id'] = alvo_id
        else:
            return Response({'erro': 'tipo inválido (use usuario ou local)'}, status=status.HTTP_400_BAD_REQUEST)

        seguindo = Follow.objects.filter(**filtro).exists()
        return Response({'seguindo': seguindo})


# ─── Comentários sociais ──────────────────────────────────────────────────────

class ComentariosItinerarioView(APIView):
    """GET  /api/social/itinerarios/<id>/comentarios/ — lista comentários
    POST /api/social/itinerarios/<id>/comentarios/ — posta comentário"""
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get(self, request, itinerario_id):
        it = get_object_or_404(Itinerario, pk=itinerario_id, status='publicado')
        comentarios = it.comentarios.select_related('autor').order_by('criado_em')
        serializer = CommentSerializer(comentarios, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request, itinerario_id):
        it = get_object_or_404(Itinerario, pk=itinerario_id, status='publicado')
        serializer = CommentSerializer(
            data={'itinerario': it.id, 'texto': request.data.get('texto', '')},
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(autor=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def delete(self, request, itinerario_id):
        """DELETE /api/social/itinerarios/<id>/comentarios/?comentario_id=<id>"""
        comentario_id = request.query_params.get('comentario_id')
        comentario = get_object_or_404(Comment, pk=comentario_id, itinerario_id=itinerario_id)
        if comentario.autor != request.user:
            return Response({'erro': 'Você só pode apagar seus próprios comentários.'}, status=status.HTTP_403_FORBIDDEN)
        comentario.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─── Hashtag feed ─────────────────────────────────────────────────────────────

class HashtagFeedView(APIView):
    """GET /api/social/hashtag/<nome>/
    Lista itinerários publicados que contêm esta hashtag."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, nome):
        hashtag = get_object_or_404(Hashtag, nome=nome.lower())
        itinerarios = (
            hashtag.itinerarios
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

        return Response({
            'hashtag': nome.lower(),
            'total': len(resultado),
            'itinerarios': resultado,
        })


# ─── Mensagens ────────────────────────────────────────────────────────────────

class ConversasView(APIView):
    """GET /api/social/mensagens/ — lista de conversas com última mensagem."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
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
            # Preview da última mensagem varia por tipo
            if ultima.tipo == 'imagem':
                preview = '📷 Imagem'
            elif ultima.tipo == 'audio':
                preview = '🎤 Áudio'
            else:
                preview = ultima.texto

            conversas.append({
                'usuario': {
                    'id': interlocutor.id,
                    'username': interlocutor.username,
                    'foto_perfil': request.build_absolute_uri(interlocutor.foto_perfil.url)
                                   if interlocutor.foto_perfil else None,
                },
                'ultima_mensagem': {
                    'texto': preview,
                    'tipo': ultima.tipo,
                    'enviada_em': ultima.enviada_em,
                    'minha': ultima.remetente_id == user.id,
                },
            })

        conversas.sort(key=lambda c: c['ultima_mensagem']['enviada_em'], reverse=True)
        return Response(conversas)


class MensagensConversaView(APIView):
    """GET/POST /api/social/mensagens/<username>/"""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

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
        serializer = MessageSerializer(mensagens, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request, username):
        outro = get_object_or_404(User, username=username)
        if outro == request.user:
            return Response({'erro': 'Você não pode enviar mensagens para si mesmo.'}, status=status.HTTP_400_BAD_REQUEST)

        tipo = request.data.get('tipo', 'texto')
        data = {
            'destinatario': outro.id,
            'tipo': tipo,
            'texto': request.data.get('texto', ''),
        }
        if tipo == 'imagem' and 'imagem' in request.FILES:
            data['imagem'] = request.FILES['imagem']
        if tipo == 'audio' and 'audio' in request.FILES:
            data['audio'] = request.FILES['audio']

        serializer = MessageSerializer(data=data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(remetente=request.user, destinatario=outro)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class UsuariosParaMensagemView(APIView):
    """GET /api/social/mensagens/destinatarios/?q=termo"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        q = request.query_params.get('q', '').strip()
        user = request.user

        seguidos_ids = Follow.objects.filter(
            seguidor=user,
            seguido_usuario__isnull=False,
        ).values_list('seguido_usuario_id', flat=True)

        qs = User.objects.exclude(pk=user.pk)
        if q:
            qs = qs.filter(username__icontains=q)

        qs = qs.annotate(
            prioridade=Case(
                When(pk__in=seguidos_ids, then=Value(0)),
                default=Value(1),
                output_field=IntegerField(),
            )
        ).order_by('prioridade', 'username')[:20]

        return Response([
            {
                'id': u.id,
                'username': u.username,
                'foto_perfil': request.build_absolute_uri(u.foto_perfil.url) if u.foto_perfil else None,
                'seguido': u.pk in seguidos_ids,
            }
            for u in qs
        ])


# ─── Busca unificada ──────────────────────────────────────────────────────────

class BuscaView(APIView):
    """GET /api/social/busca/?q=termo"""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        q = request.query_params.get('q', '').strip()
        if not q:
            return Response({'usuarios': [], 'lugares': [], 'hashtags': []})

        usuarios = User.objects.filter(username__icontains=q)[:8]
        hashtags = Hashtag.objects.filter(nome__icontains=q)[:8]

        lugares_banco = Place.objects.filter(nome__icontains=q)[:5]
        lugares_data = [
            {'tipo': 'salvo', 'id': p.id, 'nome': p.nome, 'endereco': p.endereco}
            for p in lugares_banco
        ]

        if len(q) >= 3:
            try:
                from apps.places.services import buscar_sugestoes
                sugestoes_google = buscar_sugestoes(q)
                place_ids_no_banco = set(Place.objects.filter(
                    place_id__in=[s['place_id'] for s in sugestoes_google]
                ).values_list('place_id', flat=True))

                for s in sugestoes_google:
                    if s['place_id'] in place_ids_no_banco:
                        continue
                    descricao = s.get('descricao', '')
                    partes = descricao.split(',', 1)
                    lugares_data.append({
                        'tipo': 'google',
                        'place_id': s['place_id'],
                        'nome': partes[0].strip(),
                        'endereco': descricao,
                    })
                    if len(lugares_data) >= 8:
                        break
            except Exception:
                pass

        return Response({
            'usuarios': [
                {'id': u.id, 'username': u.username,
                 'foto_perfil': request.build_absolute_uri(u.foto_perfil.url) if u.foto_perfil else None}
                for u in usuarios
            ],
            'lugares': lugares_data,
            'hashtags': [
                {'id': h.id, 'nome': h.nome,
                 'total_itinerarios': h.itinerarios.filter(status='publicado').count()}
                for h in hashtags
            ],
        })


# ─── Explorar ─────────────────────────────────────────────────────────────────

class ExplorarView(APIView):
    """GET /api/social/explorar/ — feed cronológico."""
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