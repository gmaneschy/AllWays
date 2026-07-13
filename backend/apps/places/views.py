from django.shortcuts import render
from django.db.models import Case, When, Value, IntegerField
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from apps.gamification.serializers import serializar_badge_destaque
from apps.social.services import resumo_curtida
from .models import Place
from .serializers import PlaceSerializer, PlaceDetailSerializer
from . import services


class AutocompletePlaceView(APIView):
    """GET /api/places/autocomplete/?q=catedral
    Retorna sugestões da Google Places API, SEM salvar nada."""

    def get(self, request):
        texto = request.query_params.get('q', '')
        if len(texto) < 3:
            return Response([])
        sugestoes = services.buscar_sugestoes(texto)
        return Response(sugestoes)


class CriarOuBuscarPlaceView(APIView):
    """POST /api/places/  body: {"place_id": "ChIJ..."}
    Busca detalhes no Google e salva (ou recupera, se já existir) o Place."""

    def post(self, request):
        place_id = request.data.get('place_id')
        if not place_id:
            return Response({'erro': 'place_id é obrigatório'}, status=status.HTTP_400_BAD_REQUEST)

        place_existente = Place.objects.filter(place_id=place_id).first()
        if place_existente:
            return Response(PlaceSerializer(place_existente).data)

        detalhes = services.buscar_detalhes(place_id)
        place = Place.objects.create(**detalhes)
        return Response(PlaceSerializer(place).data, status=status.HTTP_201_CREATED)


class PlaceDetailView(APIView):
    """GET /api/places/<id>/detalhe/
    Retorna o Place agregado: dados básicos, médias, foto de capa (híbrida),
    e os comentários de PontoItinerario priorizados por quem o usuário segue."""
    def get(self, request, pk):
        try:
            place = Place.objects.get(pk=pk)
        except Place.DoesNotExist:
            return Response({'erro': 'Local não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = PlaceDetailSerializer(place, context={'request': request})

        pontos_publicados = place.pontos_itinerario.filter(
            itinerario__status='publicado'
        ).select_related('itinerario__autor').prefetch_related('fotos')

        pontos_com_comentario = pontos_publicados.exclude(comentario='')
        pontos_com_foto = pontos_publicados.exclude(fotos__isnull=True).distinct()

        if request.user.is_authenticated:
            from apps.social.models import Follow
            seguidos_ids = Follow.objects.filter(
                seguidor=request.user
            ).values_list('seguido_usuario_id', flat=True)

            pontos_com_comentario = pontos_com_comentario.annotate(
                prioridade=Case(
                    When(itinerario__autor_id__in=seguidos_ids, then=Value(0)),
                    default=Value(1),
                    output_field=IntegerField()
                )
            ).order_by('prioridade', '-itinerario__publicado_em')
        else:
            pontos_com_comentario = pontos_com_comentario.order_by('-itinerario__publicado_em')

        comentarios_data = [
            {
                'ponto_id': ponto.id,
                'autor_nome': ponto.itinerario.autor.username if ponto.itinerario.autor else 'Usuário removido',
                'autor_badge_destaque': serializar_badge_destaque(ponto.itinerario.autor, context={'request': request}),
                'itinerario_id': ponto.itinerario.id,
                'itinerario_titulo': ponto.itinerario.titulo,
                'texto': ponto.comentario,
                'fotos': [request.build_absolute_uri(f.imagem.url) for f in ponto.fotos.all()],
                **resumo_curtida(ponto, request.user),
            }
            for ponto in pontos_com_comentario
        ]

        fotos_data = [
            request.build_absolute_uri(foto.imagem.url)
            for ponto in pontos_com_foto.order_by('-itinerario__publicado_em')
            for foto in ponto.fotos.all()
        ]

        return Response({
            'place': serializer.data,
            'comentarios': comentarios_data,
            'fotos': fotos_data,
        })