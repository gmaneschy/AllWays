from django.shortcuts import render
from rest_framework import viewsets, permissions
from .models import Itinerario
from .serializers import ItinerarioSerializer

# Create your views here.

class ItinerarioViewSet(viewsets.ModelViewSet):
    queryset = Itinerario.objects.all().prefetch_related('pontos')
    serializer_class = ItinerarioSerializer
    permission_classes = [permissions.AllowAny]  # trocar para IsAuthenticated quando JWT estiver pronto

    def perform_create(self, serializer):
        # Por enquanto sem autenticação real, então aceitamos autor vindo no body.
        # Quando JWT estiver configurado, troque para: serializer.save(autor=self.request.user)
        serializer.save()