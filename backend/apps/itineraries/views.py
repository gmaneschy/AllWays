from django.shortcuts import render
from rest_framework import viewsets, permissions
from rest_framework.parsers import MultiPartParser, FormParser
from .models import Itinerario, FotoPontoItinerario
from .serializers import ItinerarioSerializer, FotoPontoItinerarioSerializer

# Create your views here.

class ItinerarioViewSet(viewsets.ModelViewSet):
    queryset = Itinerario.objects.all().prefetch_related('pontos')
    serializer_class = ItinerarioSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        # Por enquanto sem autenticação real, então aceitamos autor vindo no body.
        # Quando JWT estiver configurado, troque para: serializer.save(autor=self.request.user)
        serializer.save()


class FotoPontoItinerarioViewSet(viewsets.ModelViewSet):
    queryset = FotoPontoItinerario.objects.all()
    serializer_class = FotoPontoItinerarioSerializer
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [permissions.IsAuthenticated]