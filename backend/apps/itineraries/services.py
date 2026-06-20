from django.utils import timezone


def publicar_itinerario(itinerario):
    itinerario.status = 'publicado'
    itinerario.publicado_em = timezone.now()
    itinerario.save()