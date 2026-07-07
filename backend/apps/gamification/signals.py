from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender='itineraries.Itinerario')
def avaliar_badges_ao_salvar_itinerario(sender, instance, **kwargs):
    """Dispara a avaliação de badges (assíncrona, via Celery) sempre que um
    Itinerario é salvo com status 'publicado'. Roda em toda edição posterior
    também — não só na primeira publicação — mas isso é seguro: a avaliação
    inteira é idempotente (get_or_create em UsuarioBadge), então reavaliar
    não duplica conquistas já concedidas."""
    from .tasks import avaliar_badges_usuario_task

    if instance.status == 'publicado' and instance.autor_id:
        avaliar_badges_usuario_task.delay(instance.autor_id)