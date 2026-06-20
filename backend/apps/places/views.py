from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Place
from .serializers import PlaceSerializer
from . import services

# Create your views here.

class AutocompletePlaceView(APIView):
    """GET /api/places/autocomplete/?q=catedral
    Retorna sugestões da Google Places API, SEM salvar nada."""

    def get(self, request):
        texto = request.query_params.get('q', '')
        if len(texto) < 3:
            return Response([])  # evita chamar a API com texto curto demais

        sugestoes = services.buscar_sugestoes(texto)
        return Response(sugestoes)


class CriarOuBuscarPlaceView(APIView):
    """POST /api/places/  body: {"place_id": "ChIJ..."}
    Busca detalhes no Google e salva (ou recupera, se já existir) o Place."""

    def post(self, request):
        place_id = request.data.get('place_id')
        if not place_id:
            return Response(
                {'erro': 'place_id é obrigatório'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Se já existe no banco, não chama a API de novo — evita custo desnecessário
        place_existente = Place.objects.filter(place_id=place_id).first()
        if place_existente:
            serializer = PlaceSerializer(place_existente)
            return Response(serializer.data)

        detalhes = services.buscar_detalhes(place_id)
        place = Place.objects.create(**detalhes)
        serializer = PlaceSerializer(place)
        return Response(serializer.data, status=status.HTTP_201_CREATED)