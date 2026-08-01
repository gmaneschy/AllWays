from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver


def _quer_notificacao(destinatario_id, campo_preferencia):
    """Confere a preferência de notificação do destinatário (notif_seguiu,
    notif_comentou, etc.) com uma query enxuta — sem carregar o User inteiro.
    destinatario_id=None nunca deveria chegar aqui, mas retorna False por segurança."""
    if not destinatario_id:
        return False
    from apps.users.models import User
    return User.objects.filter(
        pk=destinatario_id, **{campo_preferencia: True}
    ).exists()


@receiver(post_save, sender='social.Follow')
def notificar_novo_seguidor(sender, instance, created, **kwargs):
    if not created or not instance.seguido_usuario_id:
        return
    if not _quer_notificacao(instance.seguido_usuario_id, 'notif_seguiu'):
        return
    from .tasks import criar_notificacao_task
    criar_notificacao_task.delay(
        tipo='follow',
        destinatario_id=instance.seguido_usuario_id,
        ator_id=instance.seguidor_id,
        alvo_content_type='users.user',
        alvo_object_id=instance.seguidor_id,
    )


@receiver(post_save, sender='social.SolicitacaoSeguir')
def notificar_solicitacao_seguir(sender, instance, created, **kwargs):
    if not created:
        return
    if not _quer_notificacao(instance.alvo_id, 'notif_seguiu'):
        return
    from .tasks import criar_notificacao_task
    criar_notificacao_task.delay(
        tipo='solicitacao_seguir',
        destinatario_id=instance.alvo_id,
        ator_id=instance.solicitante_id,
        alvo_content_type='users.user',
        alvo_object_id=instance.solicitante_id,
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
        if (
            destinatario_id and destinatario_id != instance.autor_id
            and _quer_notificacao(destinatario_id, 'notif_respondeu')
        ):
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
        if (
            destinatario_id and destinatario_id != instance.autor_id
            and _quer_notificacao(destinatario_id, 'notif_comentou')
        ):
            criar_notificacao_task.delay(
                tipo='comentario',
                destinatario_id=destinatario_id,
                ator_id=instance.autor_id,
                alvo_content_type='itineraries.itinerario',
                alvo_object_id=instance.itinerario_id,
            )


@receiver(pre_save, sender='itineraries.Itinerario')
def guardar_status_anterior_itinerario(sender, instance, **kwargs):
    """Guarda o status ANTES de salvar, num atributo temporário na instância
    (não persiste, só vive durante essa chamada de save()). É o que permite
    ao post_save logo abaixo diferenciar 'acabou de publicar agora' de
    'já estava publicado e só foi editado' — diferente do sinal de badges
    (gamification/signals.py), que pode reavaliar toda vez sem problema
    porque get_or_create é idempotente; notificação não pode, ou vira spam
    a cada edição de um itinerário já publicado."""
    if not instance.pk:
        instance._status_anterior = None
        return
    from apps.itineraries.models import Itinerario
    instance._status_anterior = (
        Itinerario.objects.filter(pk=instance.pk).values_list('status', flat=True).first()
    )


@receiver(post_save, sender='itineraries.Itinerario')
def notificar_seguidores_novo_post(sender, instance, created, **kwargs):
    if instance.status != 'publicado' or not instance.autor_id:
        return

    status_anterior = getattr(instance, '_status_anterior', None)
    acabou_de_publicar = created or status_anterior != 'publicado'
    if not acabou_de_publicar:
        return

    from .tasks import notificar_seguidores_novo_post_task
    notificar_seguidores_novo_post_task.delay(instance.id, instance.autor_id)


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