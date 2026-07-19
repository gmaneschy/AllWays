import os
import shutil
import tempfile

from celery import shared_task
from django.contrib.contenttypes.models import ContentType
from django.core.files import File


@shared_task(bind=True, soft_time_limit=900, time_limit=960, max_retries=1, default_retry_delay=30)
def comprimir_video_mensagem_task(self, mensagem_id):
    """Comprime o vídeo original de uma Message e gera a thumbnail — mesmo
    pipeline de apps.itineraries.tasks.comprimir_video_ponto_task (a lógica de
    baixo nível de probe/comprimir/thumbnail já está fatorada em core.video).
    Duplicado aqui em vez de compartilhado porque os campos-alvo são diferentes
    (video_thumbnail + video_status, em vez de thumbnail + status).

    Time limit maior que o padrão do projeto (300s/360s) pelo mesmo motivo:
    encode de vídeo — principalmente vindo de 4K — pode passar dos 5 minutos."""
    from .models import Message
    from core.video import probe_video, comprimir_video, gerar_thumbnail

    try:
        mensagem = Message.objects.get(pk=mensagem_id)
    except Message.DoesNotExist:
        return

    if not mensagem.video:
        return

    storage = mensagem.video.storage
    caminho_antigo = mensagem.video.name

    with tempfile.TemporaryDirectory() as tmpdir:
        caminho_entrada = os.path.join(tmpdir, 'original' + os.path.splitext(caminho_antigo)[1])
        caminho_saida = os.path.join(tmpdir, 'comprimido.mp4')
        caminho_thumb = os.path.join(tmpdir, 'thumb.jpg')

        try:
            with mensagem.video.open('rb') as origem, open(caminho_entrada, 'wb') as destino:
                shutil.copyfileobj(origem, destino)

            duracao, _largura, altura = probe_video(caminho_entrada)
            comprimir_video(caminho_entrada, caminho_saida, altura)
            gerar_thumbnail(caminho_saida, caminho_thumb, duracao)

            with open(caminho_saida, 'rb') as f:
                mensagem.video.save(f'mensagem_{mensagem.id}.mp4', File(f), save=False)
            with open(caminho_thumb, 'rb') as f:
                mensagem.video_thumbnail.save(f'mensagem_{mensagem.id}_thumb.jpg', File(f), save=False)

            mensagem.video_status = 'pronto'
            mensagem.save(update_fields=['video', 'video_thumbnail', 'video_status'])

            # Mesmo cuidado da task de itinerários: caminho_antigo foi capturado
            # ANTES do save acima, então ainda se refere ao arquivo bruto mesmo
            # com mensagem.video.name já apontando pro comprimido.
            if caminho_antigo and caminho_antigo != mensagem.video.name:
                storage.delete(caminho_antigo)

        except Exception:
            mensagem.video_status = 'erro'
            mensagem.save(update_fields=['video_status'])


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