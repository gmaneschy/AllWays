from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from apps.itineraries.serializers import ItinerarioSerializer
from . import services

# Create your views here.

class FeedPrincipalView(APIView):
    """GET /api/feed/
    Retorna todos os itinerários publicados, mais recentes primeiro."""

    def get(self, request):
        itinerarios = services.gerar_feed_principal()
        serializer = ItinerarioSerializer(itinerarios, many=True)
        return Response(serializer.data)