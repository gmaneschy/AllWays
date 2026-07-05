import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

app = Celery('allways')

# Lê configuração do Django settings com prefixo CELERY_
app.config_from_object('django.conf:settings', namespace='CELERY')

# Descobre tasks automaticamente em todos os apps instalados
app.autodiscover_tasks()

# ─── Agendamento de tarefas periódicas ────────────────────────────────────────
app.conf.beat_schedule = {
    # Recalcula perfis de interesse de todos os usuários ativos a cada 6 horas
    'recalcular-interesses': {
        'task': 'apps.feed.tasks.recalcular_todos_interesses',
        'schedule': crontab(minute=0, hour='*/6'),
    },
    # Recalcula similaridade entre usuários uma vez por dia (às 3h da manhã)
    'recalcular-similaridades': {
        'task': 'apps.feed.tasks.recalcular_todas_similaridades',
        'schedule': crontab(minute=0, hour=3),
    },
    # Invalida caches de feed stale a cada 30 minutos
    'invalidar-feeds-stale': {
        'task': 'apps.feed.tasks.invalidar_feeds_stale',
        'schedule': crontab(minute='*/30'),
    },
}

app.conf.timezone = 'UTC'