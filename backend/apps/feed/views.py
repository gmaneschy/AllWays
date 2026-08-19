from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.shortcuts import get_object_or_404
from apps.itineraries.models import Itinerario
from apps.itineraries.serializers import PontoDetalheSerializer
from apps.gamification.serializers import BadgeItinerarioSerializer, serializar_badge_destaque
from apps.social.services import resumo_curtidas_em_lote
from apps.social.views import ExplorarView  # reutiliza o feed público
from . import services
from .models import FeedEvent


# Cap defensivo pro tamanho de página pedido pelo cliente — evita que um
# ?por_pagina=99999 force o mesmo gargalo que a paginação existe pra evitar.
POR_PAGINA_PADRAO = 10
POR_PAGINA_MAXIMO = 50


def _parse_paginacao(request):
    """Lê e sanitiza os parâmetros de paginação da querystring."""
    try:
        pagina = int(request.query_params.get('pagina', 1))
    except (TypeError, ValueError):
        pagina = 1
    try:
        por_pagina = int(request.query_params.get('por_pagina', POR_PAGINA_PADRAO))
    except (TypeError, ValueError):
        por_pagina = POR_PAGINA_PADRAO

    pagina = max(pagina, 1)
    por_pagina = min(max(por_pagina, 1), POR_PAGINA_MAXIMO)
    return pagina, por_pagina


class FeedPrincipalView(APIView):
    """GET /api/feed/principal/?pagina=1&por_pagina=10
    Retorna feed personalizado para usuários autenticados (paginado por
    score, via FeedCache), ou feed cronológico para não autenticados
    (paginado por LIMIT/OFFSET). Um lote de cada vez, nunca o feed inteiro
    — ver feed/services.py pra detalhes de como cada página já vem com o
    prefetch_related completo (pontos__local, pontos__fotos,
    pontos__videos, hashtags, badges__badge)."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        pagina, por_pagina = _parse_paginacao(request)

        if request.user.is_authenticated:
            itinerarios, tem_mais = services.gerar_feed_usuario(
                request.user, pagina=pagina, por_pagina=por_pagina,
            )
        else:
            itinerarios, tem_mais = services.gerar_feed_principal(
                pagina=pagina, por_pagina=por_pagina,
            )

        # Materializa a página (ela já é pequena — no máximo POR_PAGINA_MAXIMO
        # itens) pra poder passar a lista inteira pra resumo_curtidas_em_lote
        # de uma vez, em vez de resolver curtida item a item dentro do loop.
        itinerarios = list(itinerarios)
        curtidas_por_id = resumo_curtidas_em_lote(itinerarios, request.user)

        resultado = []
        for it in itinerarios:
            # Defensivo: mesma observação de ExplorarView em apps/social/views.py
            # — o ideal é isso ser filtrado no queryset de services.py, não aqui.
            if it.autor and not it.autor.esta_visivel:
                continue

            # it.badges já vem prefetched (com 'badge' junto, via
            # 'badges__badge') — nada disso dispara query nova por item.
            badges_itinerario = [ib.badge for ib in it.badges.all()]

            resultado.append({
                'id': it.id,
                'titulo': it.titulo,
                'tipo': it.tipo,
                'autor_nome': it.autor.username if it.autor else None,
                'autor_badge_destaque': serializar_badge_destaque(it.autor, context={'request': request}),
                'badges': BadgeItinerarioSerializer(badges_itinerario, many=True, context={'request': request}).data,
                'data_inicio': it.data_inicio,
                'data_fim': it.data_fim,
                **curtidas_por_id.get(it.id, {'total_curtidas': 0, 'curtido': False}),
                'pontos': PontoDetalheSerializer(
                    it.pontos.all(), many=True, context={'request': request},
                ).data,
            })

        return Response({
            'resultados': resultado,
            'pagina': pagina,
            'tem_mais': tem_mais,
        })


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