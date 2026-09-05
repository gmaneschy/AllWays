"""View de desenvolvimento para servir MEDIA_ROOT com suporte a HTTP Range
requests — o django.views.static.serve padrão (usado pelo helper static()
no urls.py) nunca implementou isso (ticket aberto no Django desde 2013:
https://code.djangoproject.com/ticket/22479), o que faz o AVPlayer (iOS)
ficar preso em "carregando" ao tentar tocar áudio/vídeo direto da URL
remota, sem nunca receber o 206 Partial Content que ele espera.

Só é usada em DEBUG (ver config/urls.py) — em produção, nginx/S3/CloudFront
já suportam Range nativamente, então esta view nunca entra em cena lá."""
import os
import re
import mimetypes
from django.http import StreamingHttpResponse, HttpResponseNotFound

RANGE_RE = re.compile(r'bytes=(\d*)-(\d*)')
TAMANHO_CHUNK = 8192


def _ler_intervalo(caminho, inicio, fim):
    """Generator que lê só o intervalo [inicio, fim] do arquivo, em blocos —
    evita carregar o arquivo inteiro na memória (importante pra vídeo)."""
    with open(caminho, 'rb') as f:
        f.seek(inicio)
        restante = fim - inicio + 1
        while restante > 0:
            bloco = f.read(min(TAMANHO_CHUNK, restante))
            if not bloco:
                break
            restante -= len(bloco)
            yield bloco


def serve_media_com_range(request, path, document_root):
    caminho = os.path.join(document_root, path)
    if not os.path.isfile(caminho):
        return HttpResponseNotFound()

    tamanho = os.path.getsize(caminho)
    content_type, _ = mimetypes.guess_type(caminho)
    content_type = content_type or 'application/octet-stream'

    match = RANGE_RE.match(request.META.get('HTTP_RANGE', ''))
    if match:
        inicio = int(match.group(1)) if match.group(1) else 0
        fim = int(match.group(2)) if match.group(2) else tamanho - 1
        fim = min(fim, tamanho - 1)

        resposta = StreamingHttpResponse(
            _ler_intervalo(caminho, inicio, fim),
            status=206,
            content_type=content_type,
        )
        resposta['Content-Range'] = f'bytes {inicio}-{fim}/{tamanho}'
        resposta['Content-Length'] = str(fim - inicio + 1)
    else:
        # Sem header Range: devolve o arquivo inteiro (200), igual o
        # static.serve padrão faria — só o caso com Range muda.
        resposta = StreamingHttpResponse(
            _ler_intervalo(caminho, 0, tamanho - 1),
            content_type=content_type,
        )
        resposta['Content-Length'] = str(tamanho)

    resposta['Accept-Ranges'] = 'bytes'
    return resposta