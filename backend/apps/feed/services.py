"""
feed/services.py — Motor de recomendação do AllWays

Arquitetura híbrida:
  Camada 1 — Scoring por regras:    sinais explícitos (follows, hashtags, lugares)
  Camada 2 — Filtragem colaborativa: itinerários salvos por usuários similares
  Camada 3 — Decaimento temporal:   posts muito velhos perdem relevância

O feed de usuários não autenticados é simplesmente cronológico.
"""

import math
import logging
from collections import defaultdict
from django.conf import settings
from django.utils import timezone
from apps.itineraries.models import Itinerario, ItinerarioSalvo
from apps.social.models import Follow
from .models import FeedEvent, UserInterestProfile, UserSimilarity, FeedCache

logger = logging.getLogger(__name__)

# ─── Pesos do algoritmo ───────────────────────────────────────────────────────

PESO_AUTOR_SEGUIDO = 30
PESO_LUGAR_SEGUIDO = 25
PESO_HASHTAG_INTERESSE = 20     # multiplicado pelo score de interesse (0-1)
PESO_COLABORATIVO = 15          # multiplicado pelo score de similaridade (0-1)
PESO_PROPRIO_SALVO = 0          # posts já salvos não são rebaixados, só não ganham boost
BOOST_POPULARIDADE_MAX = 10     # cap do boost por saves totais
DECAIMENTO_MEIA_VIDA_HORAS = 72 # post perde metade do score a cada 72h


# ─── Decaimento temporal ──────────────────────────────────────────────────────

def calcular_decaimento(publicado_em):
    """Fator de decaimento exponencial. Score × fator, onde fator ∈ (0, 1].
    Posts com menos de 1h têm fator ≈ 1. Posts com 72h têm fator ≈ 0.5."""
    if publicado_em is None:
        return 0.1
    horas = (timezone.now() - publicado_em).total_seconds() / 3600
    return math.exp(-math.log(2) * horas / DECAIMENTO_MEIA_VIDA_HORAS)


# ─── Camada 1: Scoring por regras ─────────────────────────────────────────────

def calcular_score_usuario(usuario, itinerario, contexto):
    """Calcula o score de um itinerário para um usuário específico.

    contexto é um dict pré-calculado com:
      - seguidos_usuario_ids: set de IDs de usuários seguidos
      - seguidos_local_ids: set de IDs de lugares seguidos
      - hashtag_scores: dict {nome: score} do perfil de interesse
      - lugar_scores: dict {id: score} do perfil de interesse
      - ids_similares: list de (usuario_b_id, similarity_score)
      - salvos_por_similares: dict {itinerario_id: score_colaborativo}
    """
    score = 0.0

    # 1. Autor seguido
    if itinerario.autor_id in contexto['seguidos_usuario_ids']:
        score += PESO_AUTOR_SEGUIDO

    # 2. Lugares seguidos
    lugares_ids = {p.local_id for p in itinerario.pontos.all()}
    matches_lugar = lugares_ids & contexto['seguidos_local_ids']
    score += len(matches_lugar) * PESO_LUGAR_SEGUIDO

    # 3. Hashtags de interesse
    for hashtag in itinerario.hashtags.all():
        interesse = contexto['hashtag_scores'].get(hashtag.nome, 0)
        if interesse > 0:
            score += interesse * PESO_HASHTAG_INTERESSE

    # 4. Lugares de interesse (do perfil)
    for lugar_id in lugares_ids:
        interesse = contexto['lugar_scores'].get(str(lugar_id), 0)
        if interesse > 0:
            score += interesse * PESO_HASHTAG_INTERESSE * 0.8  # ligeiramente menos que hashtag

    # 5. Score colaborativo (salvos por usuários similares)
    score_colab = contexto['salvos_por_similares'].get(itinerario.id, 0)
    score += score_colab

    # 6. Popularidade (capped para não dominar)
    total_saves = itinerario.salvos_por.count()
    boost_popular = min(math.log1p(total_saves) * 2, BOOST_POPULARIDADE_MAX)
    score += boost_popular

    # 7. Decaimento temporal — aplicado por último sobre o score base
    fator = calcular_decaimento(itinerario.publicado_em)
    score *= fator

    return score


def montar_contexto(usuario):
    """Carrega todos os dados necessários para scoring de uma vez,
    evitando N+1 queries durante o loop de scoring."""

    # Follows do usuário
    follows = Follow.objects.filter(seguidor=usuario).select_related()
    seguidos_usuario_ids = set(
        f.seguido_usuario_id for f in follows if f.seguido_usuario_id
    )
    seguidos_local_ids = set(
        f.seguido_local_id for f in follows if f.seguido_local_id
    )

    # Perfil de interesse
    try:
        perfil = usuario.interest_profile
        hashtag_scores = perfil.hashtag_scores
        lugar_scores = perfil.lugar_scores
    except UserInterestProfile.DoesNotExist:
        hashtag_scores = {}
        lugar_scores = {}

    # Usuários similares e itinerários que eles salvaram (filtragem colaborativa)
    similaridades = UserSimilarity.objects.filter(
        usuario_a=usuario, score__gte=0.1
    ).order_by('-score')[:20]

    salvos_por_similares = defaultdict(float)
    for sim in similaridades:
        saves_do_similar = ItinerarioSalvo.objects.filter(
            usuario_id=sim.usuario_b_id
        ).values_list('itinerario_id', flat=True)
        for it_id in saves_do_similar:
            salvos_por_similares[it_id] += sim.score * PESO_COLABORATIVO

    return {
        'seguidos_usuario_ids': seguidos_usuario_ids,
        'seguidos_local_ids': seguidos_local_ids,
        'hashtag_scores': hashtag_scores,
        'lugar_scores': {str(k): v for k, v in lugar_scores.items()},
        'salvos_por_similares': dict(salvos_por_similares),
    }


# ─── Geração do feed ──────────────────────────────────────────────────────────

def gerar_feed_usuario(usuario, forcar_recalculo=False):
    """Retorna queryset de itinerários ordenados por relevância para o usuário.

    Fluxo:
      1. Verifica FeedCache — se fresco, usa direto
      2. Se stale ou ausente, calcula scores e atualiza o cache
      3. Retorna queryset na ordem do cache
    """
    ttl = getattr(settings, 'FEED_CACHE_TTL_MINUTES', 30)
    max_items = getattr(settings, 'FEED_MAX_ITEMS', 50)

    # Tenta cache
    if not forcar_recalculo:
        try:
            cache = usuario.feed_cache
            if cache.esta_fresco(ttl):
                ids_ordenados = cache.itinerario_ids
                # Preserva a ordem do cache via Case/When
                from django.db.models import Case, When
                preserved = Case(*[When(pk=pk, then=pos) for pos, pk in enumerate(ids_ordenados)])
                return (
                    Itinerario.objects
                    .filter(status='publicado')
                    .select_related('autor')
                    .prefetch_related('pontos__local', 'hashtags')
                    .order_by('-publicado_em')
                )
        except FeedCache.DoesNotExist:
            pass

    # Recalcula
    return recalcular_feed_usuario(usuario, max_items)


def recalcular_feed_usuario(usuario, max_items=50):
    """Calcula scores para todos os itinerários publicados e salva no FeedCache."""
    logger.info(f"Recalculando feed para {usuario.username}")

    candidatos = (
        Itinerario.objects
        .filter(status='publicado')
        .exclude(autor=usuario)  # não mostra os próprios posts no feed principal
        .select_related('autor')
        .prefetch_related('pontos__local', 'hashtags', 'salvos_por')
    )

    contexto = montar_contexto(usuario)

    scores = []
    for it in candidatos:
        s = calcular_score_usuario(usuario, it, contexto)
        scores.append((it.id, s))

    # Ordena por score decrescente e pega os top max_items
    scores.sort(key=lambda x: x[1], reverse=True)
    ids_ordenados = [it_id for it_id, _ in scores[:max_items]]

    # Salva no cache
    FeedCache.objects.update_or_create(
        usuario=usuario,
        defaults={'itinerario_ids': ids_ordenados},
    )

    from django.db.models import Case, When
    preserved = Case(*[When(pk=pk, then=pos) for pos, pk in enumerate(ids_ordenados)])
    return (
        Itinerario.objects
        .filter(pk__in=ids_ordenados, status='publicado')
        .select_related('autor')
        .prefetch_related('pontos__local', 'hashtags')
        .order_by(preserved)
    )


def gerar_feed_principal():
    """Feed público (sem usuário logado) — simplesmente cronológico.
    Mantido para compatibilidade com o código existente."""
    return (
        Itinerario.objects
        .filter(status='publicado')
        .select_related('autor')
        .prefetch_related('pontos')
        .order_by('-publicado_em')
    )


# ─── Camada 2: Filtragem colaborativa ─────────────────────────────────────────

def calcular_similaridade_jaccard(usuario_a, usuario_b):
    """Jaccard similarity baseada nos itinerários salvos em comum."""
    saves_a = set(
        ItinerarioSalvo.objects.filter(usuario=usuario_a).values_list('itinerario_id', flat=True)
    )
    saves_b = set(
        ItinerarioSalvo.objects.filter(usuario=usuario_b).values_list('itinerario_id', flat=True)
    )
    if not saves_a or not saves_b:
        return 0.0
    intersecao = len(saves_a & saves_b)
    uniao = len(saves_a | saves_b)
    return intersecao / uniao if uniao > 0 else 0.0


def recalcular_similaridades_usuario(usuario):
    """Recalcula similaridade do usuário com todos os outros que têm saves."""
    min_saves = getattr(settings, 'SIMILARITY_MIN_SAVES', 2)

    # Outros usuários que têm pelo menos min_saves saves
    from django.contrib.auth import get_user_model
    User = get_user_model()

    outros = User.objects.exclude(pk=usuario.pk).filter(
        itinerarios_salvos__isnull=False
    ).distinct()

    saves_usuario = ItinerarioSalvo.objects.filter(usuario=usuario).count()
    if saves_usuario < min_saves:
        return  # Usuário sem saves suficientes não tem similaridade calculada

    for outro in outros:
        score = calcular_similaridade_jaccard(usuario, outro)
        if score > 0:
            UserSimilarity.objects.update_or_create(
                usuario_a=usuario,
                usuario_b=outro,
                defaults={'score': score},
            )
            # Simetria: A↔B e B↔A têm o mesmo score
            UserSimilarity.objects.update_or_create(
                usuario_a=outro,
                usuario_b=usuario,
                defaults={'score': score},
            )


# ─── Camada 3: Perfil de interesse ────────────────────────────────────────────

def recalcular_interesse_usuario(usuario):
    """Constrói o perfil de interesse do usuário a partir dos FeedEvents.

    Score por hashtag:
      Σ peso_evento × fator_decaimento_evento
      normalizado para o intervalo [0, 1]

    Score por lugar: mesmo cálculo mas por lugar dos itinerários interagidos.
    """
    decay_days = getattr(settings, 'INTEREST_DECAY_DAYS', 30)
    agora = timezone.now()

    eventos = (
        FeedEvent.objects
        .filter(usuario=usuario)
        .select_related('itinerario')
        .prefetch_related('itinerario__hashtags', 'itinerario__pontos__local')
    )

    hashtag_raw = defaultdict(float)
    lugar_raw = defaultdict(float)

    for evento in eventos:
        peso = FeedEvent.PESO.get(evento.tipo, 1)
        # Decaimento do evento em si (interesse recente vale mais)
        dias = (agora - evento.criado_em).days
        fator = math.exp(-dias / decay_days)
        contribuicao = peso * fator

        for hashtag in evento.itinerario.hashtags.all():
            hashtag_raw[hashtag.nome] += contribuicao

        for ponto in evento.itinerario.pontos.all():
            lugar_raw[ponto.local_id] += contribuicao

    # Normaliza para [0, 1]
    def normalizar(d):
        if not d:
            return {}
        max_val = max(d.values())
        if max_val == 0:
            return {}
        return {k: round(v / max_val, 4) for k, v in d.items()}

    UserInterestProfile.objects.update_or_create(
        usuario=usuario,
        defaults={
            'hashtag_scores': normalizar(hashtag_raw),
            'lugar_scores': normalizar({str(k): v for k, v in lugar_raw.items()}),
        },
    )