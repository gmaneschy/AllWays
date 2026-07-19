import os
import shutil
import tempfile

from celery import shared_task
from django.core.files import File


@shared_task(bind=True, soft_time_limit=900, time_limit=960, max_retries=1, default_retry_delay=30)
def comprimir_video_ponto_task(self, video_id):
    """Comprime o vídeo original de um PontoItinerario e gera a thumbnail.

    Time limit maior que o padrão do projeto (CELERY_TASK_SOFT_TIME_LIMIT=300 /
    CELERY_TASK_TIME_LIMIT=360 em settings) porque encode de vídeo — principalmente
    partindo de 4K — pode legitimamente passar dos 5 minutos; o decorator sobrescreve
    o limite global só pra essa task.

    O arquivo original só é apagado do storage DEPOIS que a versão comprimida
    é salva com sucesso — é aí que mora a economia de espaço."""
    from .models import VideoPontoItinerario
    from core.video import probe_video, comprimir_video, gerar_thumbnail

    try:
        video = VideoPontoItinerario.objects.get(pk=video_id)
    except VideoPontoItinerario.DoesNotExist:
        return

    if not video.video:
        return

    storage = video.video.storage
    caminho_antigo = video.video.name

    with tempfile.TemporaryDirectory() as tmpdir:
        caminho_entrada = os.path.join(tmpdir, 'original' + os.path.splitext(caminho_antigo)[1])
        caminho_saida = os.path.join(tmpdir, 'comprimido.mp4')
        caminho_thumb = os.path.join(tmpdir, 'thumb.jpg')

        try:
            with video.video.open('rb') as origem, open(caminho_entrada, 'wb') as destino:
                shutil.copyfileobj(origem, destino)

            # Já foi validado no upload (view), mas precisamos da altura de novo
            # aqui pra decidir se faz downscale na compressão.
            duracao, _largura, altura = probe_video(caminho_entrada)
            comprimir_video(caminho_entrada, caminho_saida, altura)
            gerar_thumbnail(caminho_saida, caminho_thumb, duracao)

            with open(caminho_saida, 'rb') as f:
                video.video.save(f'ponto_{video.ponto_id}_{video.id}.mp4', File(f), save=False)
            with open(caminho_thumb, 'rb') as f:
                video.thumbnail.save(f'ponto_{video.ponto_id}_{video.id}_thumb.jpg', File(f), save=False)

            video.tamanho_bytes = os.path.getsize(caminho_saida)
            video.status = 'pronto'
            video.erro_detalhe = ''
            video.save(update_fields=['video', 'thumbnail', 'tamanho_bytes', 'status', 'erro_detalhe'])

            # Só apaga o bruto depois que o comprimido já está salvo e o registro
            # aponta pro novo nome — caminho_antigo foi capturado ANTES do save
            # acima, então continua se referindo ao arquivo original mesmo com
            # video.video.name já tendo mudado.
            if caminho_antigo and caminho_antigo != video.video.name:
                storage.delete(caminho_antigo)

        except Exception as e:
            video.status = 'erro'
            video.erro_detalhe = str(e)[:500]
            video.save(update_fields=['status', 'erro_detalhe'])