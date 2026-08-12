import os
import tempfile

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import render, get_object_or_404
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError
from .models import Itinerario, FotoPontoItinerario, PontoItinerario, VideoPontoItinerario
from .serializers import (
    ItinerarioSerializer, FotoPontoItinerarioSerializer, ItinerarioDetalheSerializer,
    VideoPontoItinerarioSerializer,
)
from . import services as itinerario_services
from core.video import probe_video, validar_video


class ItinerarioViewSet(viewsets.ModelViewSet):
    queryset = Itinerario.objects.all().prefetch_related('pontos')
    serializer_class = ItinerarioSerializer

    def get_permissions(self):
        # Leitura pública; escrita exige autenticação
        if self.action in ('list', 'retrieve'):
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = Itinerario.objects.prefetch_related('pontos__local', 'pontos__fotos')

        # ?autor=me → só itinerários do usuário logado (rascunhos + publicados)
        if self.request.query_params.get('autor') == 'me':
            if self.request.user.is_authenticated:
                return qs.filter(autor=self.request.user).order_by('-publicado_em', '-id')
            return qs.none()

        # Escrita (update/partial_update/destroy): só o próprio autor, mesmo
        # se o itinerário estiver publicado. A união com status='publicado'
        # logo abaixo existe só pra LEITURA (qualquer um pode ver um post
        # publicado de outra pessoa) — sem essa checagem separada aqui, o
        # DRF resolve o objeto do destroy/update com o mesmo queryset da
        # leitura, e qualquer usuário autenticado conseguiria apagar ou
        # editar itinerário publicado alheio via DELETE/PATCH direto no
        # endpoint, não só o dono.
        if self.action in ('update', 'partial_update', 'destroy'):
            if not self.request.user.is_authenticated:
                return qs.none()
            return qs.filter(autor=self.request.user)

        # Não-autenticados e outros usuários só veem publicados
        if not self.request.user.is_authenticated:
            return qs.filter(status='publicado')
        # Dono vê os próprios (inclusive rascunhos) + publicados de outros
        return qs.filter(
            status='publicado'
        ) | qs.filter(autor=self.request.user)

    def perform_create(self, serializer):
        serializer.save(autor=self.request.user)

    @action(detail=True, methods=['post'])
    def publicar(self, request, pk=None):
        """POST /itinerarios/<id>/publicar/ — transição rascunho → publicado.

        Chamado pelo frontend só depois que título/pontos já foram salvos
        (via create/update normal) E toda a mídia de cada ponto já foi
        enviada (/fotos/, /videos/). get_queryset() já garante que só o
        autor enxerga/edita o próprio rascunho, então get_object() aqui
        cobre a checagem de posse sem precisar repeti-la."""
        itinerario = self.get_object()

        if itinerario.status == 'publicado':
            return Response(
                {'erro': 'Este itinerário já está publicado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            itinerario_services.publicar_itinerario(itinerario)
        except DjangoValidationError as e:
            return Response({'erros': e.messages}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(itinerario)
        return Response(serializer.data)


class ItinerarioDetalhePublicoView(APIView):
    """GET /api/itineraries/itinerarios/<id>/detalhe/
    Retorna itinerário completo com pontos, fotos e info do autor.
    Rascunhos só acessíveis pelo próprio autor."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        it = get_object_or_404(
            Itinerario.objects.select_related('autor').prefetch_related(
                'pontos__local', 'pontos__fotos'
            ),
            pk=pk,
        )
        # Rascunho: só o próprio autor pode ver
        if it.status == 'rascunho':
            if not request.user.is_authenticated or request.user != it.autor:
                return Response(
                    {'erro': 'Este itinerário não está disponível.'},
                    status=status.HTTP_404_NOT_FOUND,
                )

        serializer = ItinerarioDetalheSerializer(it, context={'request': request})
        return Response(serializer.data)


class FotoPontoItinerarioViewSet(viewsets.ModelViewSet):
    queryset = FotoPontoItinerario.objects.all()
    serializer_class = FotoPontoItinerarioSerializer
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Usuário só vê/edita fotos de itinerários que ele é autor
        return FotoPontoItinerario.objects.filter(ponto__itinerario__autor=self.request.user)

    def create(self, request, *args, **kwargs):
        ponto_id = request.data.get('ponto')
        ponto = get_object_or_404(PontoItinerario, pk=ponto_id)

        if ponto.itinerario.autor_id != request.user.id:
            return Response(
                {'erro': 'Você só pode adicionar fotos aos seus próprios itinerários.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Aceita tanto 'imagem' (uma foto) quanto 'imagens' (múltiplas, via FormData.append repetido)
        arquivos = request.FILES.getlist('imagens') or request.FILES.getlist('imagem')
        if not arquivos:
            return Response(
                {'erro': 'Envie ao menos uma imagem no campo "imagens".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        criadas = []
        for arquivo in arquivos:
            foto = FotoPontoItinerario.objects.create(ponto=ponto, imagem=arquivo)
            criadas.append(foto)

        serializer = self.get_serializer(criadas, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class VideoPontoItinerarioViewSet(viewsets.ModelViewSet):
    """Upload de vídeo de um ponto. O arquivo é validado de forma síncrona
    (duração e resolução, via ffprobe) antes de criar qualquer registro — se
    inválido, o request retorna 400 sem tocar no banco nem no storage. Se
    válido, o vídeo original é salvo com status='processando' e a compressão
    de fato roda em background (apps.itineraries.tasks.comprimir_video_ponto_task),
    do mesmo jeito que gamification/feed já usam Celery pra trabalho pesado."""
    queryset = VideoPontoItinerario.objects.all()
    serializer_class = VideoPontoItinerarioSerializer
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Mesma regra da FotoPontoItinerarioViewSet: só o autor mexe nos próprios vídeos.
        return VideoPontoItinerario.objects.filter(ponto__itinerario__autor=self.request.user)

    def create(self, request, *args, **kwargs):
        ponto_id = request.data.get('ponto')
        ponto = get_object_or_404(PontoItinerario, pk=ponto_id)

        if ponto.itinerario.autor_id != request.user.id:
            return Response(
                {'erro': 'Você só pode adicionar vídeos aos seus próprios itinerários.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        arquivo = request.FILES.get('video')
        if not arquivo:
            return Response(
                {'erro': 'Envie um vídeo no campo "video".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        tamanho_maximo_bytes = settings.VIDEO_TAMANHO_MAXIMO_MB * 1024 * 1024
        if arquivo.size > tamanho_maximo_bytes:
            return Response(
                {'erro': f'O vídeo excede o tamanho máximo de {settings.VIDEO_TAMANHO_MAXIMO_MB}MB.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Grava num temp file só pra rodar o ffprobe (leitura de metadados, rápida —
        # não decodifica o vídeo inteiro). O arquivo em si é salvo no storage
        # normalmente logo depois, via campo do model.
        sufixo = os.path.splitext(arquivo.name)[1] or '.mp4'
        with tempfile.NamedTemporaryFile(suffix=sufixo, delete=False) as tmp:
            for chunk in arquivo.chunks():
                tmp.write(chunk)
            caminho_temp = tmp.name

        try:
            duracao, largura, altura = probe_video(caminho_temp)
            validar_video(duracao, largura, altura)
        except ValidationError as e:
            return Response({'erro': e.detail}, status=status.HTTP_400_BAD_REQUEST)
        finally:
            os.remove(caminho_temp)

        arquivo.seek(0)  # rebobina — já foi consumido pelo .chunks() acima
        video = VideoPontoItinerario.objects.create(
            ponto=ponto, video=arquivo, duracao_segundos=round(duracao), status='processando',
        )

        from .tasks import comprimir_video_ponto_task
        comprimir_video_ponto_task.delay(video.id)

        serializer = self.get_serializer(video)
        return Response(serializer.data, status=status.HTTP_201_CREATED)