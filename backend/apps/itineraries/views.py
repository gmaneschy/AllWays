from django.shortcuts import render, get_object_or_404
from rest_framework import viewsets, permissions, status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from .models import Itinerario, FotoPontoItinerario, PontoItinerario
from .serializers import ItinerarioSerializer, FotoPontoItinerarioSerializer

# Create your views here.

class ItinerarioViewSet(viewsets.ModelViewSet):
    queryset = Itinerario.objects.all().prefetch_related('pontos')
    serializer_class = ItinerarioSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(autor=self.request.user)


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