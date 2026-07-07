from celery import shared_task
from django.contrib.auth import get_user_model

from .services import avaliar_e_conceder_badges

User = get_user_model()


@shared_task
def avaliar_badges_usuario_task(usuario_id):
    """Task assíncrona disparada pelo signal de publicação de itinerário.
    Isola o cálculo (queries + pycountry) do ciclo de request/response."""
    try:
        usuario = User.objects.get(pk=usuario_id)
    except User.DoesNotExist:
        return
    avaliar_e_conceder_badges(usuario)


@shared_task
def avaliar_badges_todos_usuarios_task():
    """Task periódica de garantia (rede de segurança). Reavalia o usuário
    com pelo menos 1 itinerário publicado — cobre casos em que:
    - o worker Celery estava fora do ar no momento da publicação (o signal
      dispara, mas a task nunca é processada);
    - os valores/critérios de um badge foram alterados no admin DEPOIS que o
      usuário já atingia o novo critério com itinerários antigos (o signal só
      dispara em cima de uma nova publicação, não retroativamente)."""
    ids_com_itinerario_publicado = (
        User.objects.filter(itinerario__status='publicado')
        .distinct()
        .values_list('id', flat=True)
    )
    for usuario_id in ids_com_itinerario_publicado:
        avaliar_badges_usuario_task.delay(usuario_id)