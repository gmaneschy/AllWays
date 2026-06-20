from django.utils import timezone
from apps.places.services import calcular_distancia

def publicar_itinerario(itinerario):
    itinerario.status = 'publicado'
    itinerario.publicado_em = timezone.now()
    itinerario.save()

def calcular_distancias_itinerario(itinerario):
    pontos = list(itinerario.pontos.order_by('ordem'))

    for i in range(len(pontos) - 1):
        atual = pontos[i]
        proximo = pontos[i + 1]

        distancia = calcular_distancia(
            atual.local.latitude, atual.local.longitude,
            proximo.local.latitude, proximo.local.longitude
        )

        atual.distancia_ate_proximo = distancia
        atual.save()