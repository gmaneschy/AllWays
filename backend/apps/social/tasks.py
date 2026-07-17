from celery import shared_task
from django.contrib.contenttypes.models import ContentType


@shared_task
def criar_notificacao_task(tipo, destinatario_id, ator_id=None, alvo_content_type=None, alvo_object_id=None):
    """Task assíncrona disparada pelos signals de follow/comentário/resposta/mensagem/curtida.
    Recebe só ids e a string 'app_label.model' (nunca objetos), do mesmo jeito que
    avaliar_badges_usuario_task só recebe usuario_id — evita problema de serialização
    do Celery e mantém o worker sem depender de instância viva do objeto."""
    from .models import Notification

    content_type = None
    if alvo_content_type:
        app_label, model = alvo_content_type.split('.')
        content_type = ContentType.objects.get_by_natural_key(app_label, model)

    Notification.objects.create(
        destinatario_id=destinatario_id,
        ator_id=ator_id,
        tipo=tipo,
        content_type=content_type,
        object_id=alvo_object_id,
    )