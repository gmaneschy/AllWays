from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender='social.Follow')
def notificar_novo_seguidor(sender, instance, created, **kwargs):
    if not created or not instance.seguido_usuario_id:
        return
    from .tasks import criar_notificacao_task
    criar_notificacao_task.delay(
        tipo='follow',
        destinatario_id=instance.seguido_usuario_id,
        ator_id=instance.seguidor_id,
        alvo_content_type='users.user',
        alvo_object_id=instance.seguidor_id,
    )


@receiver(post_save, sender='social.Comment')
def notificar_comentario(sender, instance, created, **kwargs):
    if not created:
        return
    from .tasks import criar_notificacao_task

    if instance.parent_id:
        # Resposta dentro de uma thread: notifica quem foi especificamente
        # mencionado (responder_para), não necessariamente o autor do comentário raiz.
        destinatario_id = instance.responder_para_id
        if destinatario_id and destinatario_id != instance.autor_id:
            criar_notificacao_task.delay(
                tipo='resposta_comentario',
                destinatario_id=destinatario_id,
                ator_id=instance.autor_id,
                alvo_content_type='social.comment',
                alvo_object_id=instance.id,
            )
    else:
        # Comentário de primeiro nível: notifica o autor do itinerário.
        destinatario_id = instance.itinerario.autor_id
        if destinatario_id and destinatario_id != instance.autor_id:
            criar_notificacao_task.delay(
                tipo='comentario',
                destinatario_id=destinatario_id,
                ator_id=instance.autor_id,
                alvo_content_type='itineraries.itinerario',
                alvo_object_id=instance.itinerario_id,
            )


@receiver(post_save, sender='social.Message')
def notificar_mensagem(sender, instance, created, **kwargs):
    if not created or not instance.destinatario_id:
        return
    if instance.destinatario_id == instance.remetente_id:
        return
    from .tasks import criar_notificacao_task
    criar_notificacao_task.delay(
        tipo='mensagem',
        destinatario_id=instance.destinatario_id,
        ator_id=instance.remetente_id,
        alvo_content_type='social.message',
        alvo_object_id=instance.id,
    )


@receiver(post_save, sender='social.Curtida')
def notificar_curtida(sender, instance, created, **kwargs):
    if not created:
        return
    from .tasks import criar_notificacao_task
    destinatario_id = _dono_do_alvo(instance.alvo)
    if destinatario_id and destinatario_id != instance.usuario_id:
        criar_notificacao_task.delay(
            tipo='curtida',
            destinatario_id=destinatario_id,
            ator_id=instance.usuario_id,
            alvo_content_type=f'{instance.content_type.app_label}.{instance.content_type.model}',
            alvo_object_id=instance.object_id,
        )


def _dono_do_alvo(alvo):
    """Resolve o dono (id de User) do objeto curtido, dependendo do tipo.
    Mantido aqui (não em services.py) porque só importa pra esse signal específico."""
    from apps.itineraries.models import Itinerario, PontoItinerario
    from .models import Comment, Message

    if alvo is None:
        return None
    if isinstance(alvo, Itinerario):
        return alvo.autor_id
    if isinstance(alvo, Comment):
        return alvo.autor_id
    if isinstance(alvo, PontoItinerario):
        # Comentário de lugar não tem autor próprio — pertence ao itinerário.
        return alvo.itinerario.autor_id
    if isinstance(alvo, Message):
        return alvo.remetente_id
    return None