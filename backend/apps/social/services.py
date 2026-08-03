from django.contrib.contenttypes.models import ContentType
from django.db.models import Count
from .models import Curtida


def resumo_curtidas_em_lote(alvos, usuario):
    """Versão em lote de resumo_curtida — pra usar em listas (feed, explorar,
    qualquer lugar que serialize vários itens do MESMO model de uma vez).

    Chamar resumo_curtida() um item por vez numa lista de N itens custa até
    2×N queries (uma pro total de curtidas, uma pro "usuário curtiu isso?").
    Esta função faz a mesma coisa em no máximo 2 queries, não importa o N.

    alvos: iterável de instâncias do MESMO model (ex.: uma página de
    Itinerario). Não pode misturar models diferentes numa mesma chamada,
    já que o content_type é resolvido a partir do primeiro item.

    Retorna {alvo.pk: {'total_curtidas': int, 'curtido': bool}} — pra
    quem serializa, é só fazer resultado.get(item.pk, {...default...}).
    """
    alvos = list(alvos)
    if not alvos:
        return {}

    content_type = ContentType.objects.get_for_model(type(alvos[0]))
    ids = [a.pk for a in alvos]

    contagens = (
        Curtida.objects
        .filter(content_type=content_type, object_id__in=ids)
        .values('object_id')
        .annotate(total=Count('id'))
    )
    totais_por_id = {c['object_id']: c['total'] for c in contagens}

    curtidos_ids = set()
    if usuario is not None and usuario.is_authenticated:
        curtidos_ids = set(
            Curtida.objects
            .filter(content_type=content_type, object_id__in=ids, usuario=usuario)
            .values_list('object_id', flat=True)
        )

    return {
        a.pk: {
            'total_curtidas': totais_por_id.get(a.pk, 0),
            'curtido': a.pk in curtidos_ids,
        }
        for a in alvos
    }


def resumo_curtida(alvo, usuario):
    """Retorna {'total_curtidas': int, 'curtido': bool} para qualquer instância
    de model curtível (Itinerario, Comment, PontoItinerario, Message).

    Reutilizável por qualquer serializer/view de qualquer app — evita duplicar
    a lógica de ContentType toda vez que um novo lugar precisar exibir curtidas.
    'usuario' pode ser um AnonymousUser (request.user em endpoint público);
    nesse caso 'curtido' sempre vem False.
    """
    content_type = ContentType.objects.get_for_model(alvo)
    total = Curtida.objects.filter(content_type=content_type, object_id=alvo.pk).count()

    curtido = False
    if usuario is not None and usuario.is_authenticated:
        curtido = Curtida.objects.filter(
            content_type=content_type, object_id=alvo.pk, usuario=usuario
        ).exists()

    return {'total_curtidas': total, 'curtido': curtido}