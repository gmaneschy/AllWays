"""
feed/tasks.py — Tarefas Celery do sistema de recomendação

Hierarquia de execução:
  recalcular_todos_interesses    → a cada 6h  → dispara recalcular_interesse_usuario por usuário
  recalcular_todas_similaridades → a cada 24h → dispara recalcular_similaridades_usuario por usuário
  invalidar_feeds_stale          → a cada 30min → marca feeds velhos para recalculo lazy
  recalcular_feed_usuario_task   → chamado on-demand quando feed está stale
"""

import logging
from celery import shared_task
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta

logger = logging.getLogger(__name__)
User = get_user_model()


# ─── Tarefas por usuário (chamadas individualmente para paralelismo) ───────────

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def recalcular_interesse_usuario_task(self, usuario_id):
    """Recalcula o perfil de interesse de um único usuário."""
    try:
        from . import services
        usuario = User.objects.get(pk=usuario_id)
        services.recalcular_interesse_usuario(usuario)
        logger.info(f"Interesse recalculado para usuário {usuario.username}")
    except User.DoesNotExist:
        logger.warning(f"Usuário {usuario_id} não encontrado — ignorando.")
    except Exception as exc:
        logger.error(f"Erro ao recalcular interesse de {usuario_id}: {exc}")
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def recalcular_similaridade_usuario_task(self, usuario_id):
    """Recalcula similaridade de um único usuário com os demais."""
    try:
        from . import services
        usuario = User.objects.get(pk=usuario_id)
        services.recalcular_similaridades_usuario(usuario)
        logger.info(f"Similaridade recalculada para usuário {usuario.username}")
    except User.DoesNotExist:
        logger.warning(f"Usuário {usuario_id} não encontrado — ignorando.")
    except Exception as exc:
        logger.error(f"Erro ao recalcular similaridade de {usuario_id}: {exc}")
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=2)
def recalcular_feed_usuario_task(self, usuario_id):
    """Recalcula o feed de um único usuário e atualiza o FeedCache."""
    try:
        from . import services
        usuario = User.objects.get(pk=usuario_id)
        services.recalcular_feed_usuario(usuario)
        logger.info(f"Feed recalculado para usuário {usuario.username}")
    except User.DoesNotExist:
        logger.warning(f"Usuário {usuario_id} não encontrado — ignorando.")
    except Exception as exc:
        logger.error(f"Erro ao recalcular feed de {usuario_id}: {exc}")
        raise self.retry(exc=exc)


# ─── Tarefas periódicas (agendadas pelo Celery Beat) ──────────────────────────

@shared_task
def recalcular_todos_interesses():
    """Dispara recálculo de interesse para todos os usuários com eventos recentes.
    Considera 'ativo' quem teve algum FeedEvent nos últimos 30 dias."""
    from .models import FeedEvent
    trinta_dias = timezone.now() - timedelta(days=30)
    usuario_ids = (
        FeedEvent.objects
        .filter(criado_em__gte=trinta_dias)
        .values_list('usuario_id', flat=True)
        .distinct()
    )
    count = 0
    for uid in usuario_ids:
        recalcular_interesse_usuario_task.delay(uid)
        count += 1
    logger.info(f"Disparado recálculo de interesse para {count} usuários.")
    return count


@shared_task
def recalcular_todas_similaridades():
    """Dispara recálculo de similaridade para todos os usuários com saves."""
    from apps.itineraries.models import ItinerarioSalvo
    usuario_ids = (
        ItinerarioSalvo.objects
        .values_list('usuario_id', flat=True)
        .distinct()
    )
    count = 0
    for uid in usuario_ids:
        recalcular_similaridade_usuario_task.delay(uid)
        count += 1
    logger.info(f"Disparado recálculo de similaridade para {count} usuários.")
    return count


@shared_task
def invalidar_feeds_stale():
    """Apaga FeedCaches mais velhos que FEED_CACHE_TTL_MINUTES para forçar
    recálculo lazy no próximo request. Mais eficiente que recalcular todo mundo."""
    from django.conf import settings
    from .models import FeedCache
    ttl = getattr(settings, 'FEED_CACHE_TTL_MINUTES', 30)
    limite = timezone.now() - timedelta(minutes=ttl)
    deletados, _ = FeedCache.objects.filter(gerado_em__lt=limite).delete()
    logger.info(f"{deletados} FeedCaches stale removidos.")
    return deletados


@shared_task
def registrar_evento_feed(usuario_id, itinerario_id, tipo):
    """Registra um FeedEvent de forma assíncrona.
    Chamado pelas views para não bloquear o request."""
    from .models import FeedEvent
    try:
        FeedEvent.objects.create(
            usuario_id=usuario_id,
            itinerario_id=itinerario_id,
            tipo=tipo,
        )
    except Exception as exc:
        logger.error(f"Erro ao registrar evento {tipo} para usuário {usuario_id}: {exc}")