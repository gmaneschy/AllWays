# Aqui fica lógica de recomendação isolada.
# Criar algoritmo no futuro. Por hora, apenas um feed populado por todos os itinerarios ja criados.

from apps.itineraries.models import Itinerario


def gerar_feed_principal():
    """Versão simples: todos os itinerários publicados, mais recentes primeiro.
    Sem personalização por enquanto — isso vira algoritmo de recomendação no futuro."""
    return Itinerario.objects.filter(
        status='publicado'
    ).select_related('autor').prefetch_related('pontos').order_by('-publicado_em')
