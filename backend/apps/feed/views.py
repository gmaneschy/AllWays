from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.shortcuts import get_object_or_404
from apps.itineraries.models import Itinerario
from apps.gamification.models import BadgeItinerario
from apps.gamification.serializers import BadgeItinerarioSerializer, serializar_badge_destaque
from apps.social.services import resumo_curtida
from apps.social.views import ExplorarView  # reutiliza o feed público
from . import services
from .models import FeedEvent


class FeedPrincipalView(APIView):
    """GET /api/feed/principal/
    Retorna feed personalizado para usuários autenticados,
    ou feed cronológico para não autenticados."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        if request.user.is_authenticated:
            itinerarios = services.gerar_feed_usuario(request.user)
        else:
            itinerarios = services.gerar_feed_principal()

        resultado = []
        for it in itinerarios:
            badges_ids = it.badges.values_list('badge_id', flat=True)
            badges_itinerario = BadgeItinerario.objects.filter(id__in=badges_ids)

            resultado.append({
                'id': it.id,
                'titulo': it.titulo,
                'tipo': it.tipo,
                'autor_nome': it.autor.username if it.autor else None,
                'autor_badge_destaque': serializar_badge_destaque(it.autor, context={'request': request}),
                'badges': BadgeItinerarioSerializer(badges_itinerario, many=True, context={'request': request}).data,
                'data_inicio': it.data_inicio,
                'data_fim': it.data_fim,
                **resumo_curtida(it, request.user),
                'pontos': [
                    {
                        'id': ponto.id,
                        'local': ponto.local_id,
                        'local_nome': ponto.local.nome,
                        'movimentacao': ponto.movimentacao or None,
                        'entrada_gratuita': ponto.entrada_gratuita,
                        'preco_medio': ponto.preco_medio,
                        'seguranca': ponto.seguranca,
                        'comentario': ponto.comentario or None,
                        'distancia_ate_proximo': ponto.distancia_ate_proximo,
                    }
                    for ponto in it.pontos.all()
                ],
            })

        return Response(resultado)


class FeedEventView(APIView):
    """POST /api/feed/evento/
    Registra uma interação do usuário com um itinerário.
    Chamado pelo frontend ao visualizar, comentar, etc.

    Body: {"itinerario_id": <int>, "tipo": "view"|"comment_read"|"save"|"use_as_base"|"comment_post"}
    """
    permission_classes = [permissions.IsAuthenticated]

    TIPOS_VALIDOS = {'view', 'comment_read', 'save', 'use_as_base', 'comment_post'}

    def post(self, request):
        itinerario_id = request.data.get('itinerario_id')
        tipo = request.data.get('tipo')

        if tipo not in self.TIPOS_VALIDOS:
            return Response(
                {'erro': f'Tipo inválido. Use: {", ".join(self.TIPOS_VALIDOS)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        it = get_object_or_404(Itinerario, pk=itinerario_id, status='publicado')

        from .tasks import registrar_evento_feed
        registrar_evento_feed.delay(request.user.id, it.id, tipo)

        return Response({'registrado': True})


class FeedStatusView(APIView):
    """GET /api/feed/status/ — debug: mostra info do cache do usuário logado."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            cache = request.user.feed_cache
            return Response({
                'tem_cache': True,
                'itens': len(cache.itinerario_ids),
                'gerado_em': cache.gerado_em,
                'fresco': cache.esta_fresco(),
            })
        except Exception:
            return Response({'tem_cache': False})