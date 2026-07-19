"""Utilitários de vídeo compartilhados entre apps.itineraries e apps.social.

Fluxo padrão de uso:
1. No momento do upload (view), grava o arquivo enviado em um temp file e chama
   `probe_video()` + `validar_video()` — rápido, só lê metadados, não decodifica
   o vídeo inteiro. Se inválido, rejeita antes de criar qualquer registro.
2. Depois de criado o registro com status='processando', uma task Celery baixa
   o arquivo original do storage e chama `comprimir_video()` + `gerar_thumbnail()`.
"""
import ffmpeg
from django.conf import settings
from rest_framework import serializers


def probe_video(caminho):
    """Roda ffprobe no arquivo e retorna (duracao_segundos, largura, altura).
    Lança serializers.ValidationError se o arquivo não puder ser lido como vídeo."""
    try:
        info = ffmpeg.probe(caminho)
    except ffmpeg.Error:
        raise serializers.ValidationError(
            "Não foi possível ler o vídeo enviado. Verifique se o arquivo não está corrompido."
        )

    stream_video = next((s for s in info.get('streams', []) if s.get('codec_type') == 'video'), None)
    if stream_video is None:
        raise serializers.ValidationError("O arquivo enviado não contém uma trilha de vídeo válida.")

    duracao_bruta = info.get('format', {}).get('duration') or stream_video.get('duration') or 0
    try:
        duracao = float(duracao_bruta)
    except (TypeError, ValueError):
        duracao = 0.0

    largura = int(stream_video.get('width') or 0)
    altura = int(stream_video.get('height') or 0)
    return duracao, largura, altura


def validar_video(duracao, largura, altura):
    """Levanta serializers.ValidationError se o vídeo violar os limites do projeto."""
    if duracao <= 0:
        raise serializers.ValidationError("Não foi possível determinar a duração do vídeo.")

    if duracao > settings.VIDEO_DURACAO_MAXIMA_SEGUNDOS:
        raise serializers.ValidationError(
            f"O vídeo excede a duração máxima de {settings.VIDEO_DURACAO_MAXIMA_SEGUNDOS} segundos."
        )

    maior_lado = max(largura, altura)
    if maior_lado > settings.VIDEO_MAIOR_LADO_MAXIMO:
        raise serializers.ValidationError("O vídeo excede a resolução máxima suportada (4K).")


def comprimir_video(caminho_entrada, caminho_saida, altura_original):
    """Recodifica em H.264/AAC (MP4, faststart pra streaming progressivo).

    Só faz downscale se a altura original passar de VIDEO_ALTURA_ALVO_COMPRESSAO —
    abaixo disso mantém a resolução e ganha espaço só via CRF, que é onde mora a
    maior parte da economia sem perda perceptível."""
    stream = ffmpeg.input(caminho_entrada)

    if altura_original and altura_original > settings.VIDEO_ALTURA_ALVO_COMPRESSAO:
        # -2 mantém a largura proporcional e par (requisito do libx264)
        stream = stream.filter('scale', -2, settings.VIDEO_ALTURA_ALVO_COMPRESSAO)

    saida = ffmpeg.output(
        stream, caminho_saida,
        vcodec='libx264',
        crf=settings.VIDEO_CRF,
        preset=settings.VIDEO_PRESET,
        acodec='aac',
        audio_bitrate=settings.VIDEO_BITRATE_AUDIO,
        pix_fmt='yuv420p',
        movflags='+faststart',
    )
    ffmpeg.run(saida, overwrite_output=True, quiet=True)


def gerar_thumbnail(caminho_video, caminho_saida, duracao):
    """Extrai um frame como capa. Usa offset de 1s (ou 0 se o vídeo for
    curtíssimo) pra evitar pegar um frame preto de fade-in."""
    offset = 1 if duracao and duracao > 1.5 else 0
    (
        ffmpeg
        .input(caminho_video, ss=offset)
        .output(caminho_saida, vframes=1)
        .overwrite_output()
        .run(quiet=True)
    )