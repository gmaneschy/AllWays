from django.contrib.contenttypes.models import ContentType
from .models import Curtida


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