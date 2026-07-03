from rest_framework import serializers
from .models import Place


class PlaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Place
        fields = ['id', 'place_id', 'nome', 'endereco', 'latitude', 'longitude']


class PlaceDetailSerializer(serializers.ModelSerializer):
    foto_capa = serializers.SerializerMethodField()
    seguranca_media = serializers.ReadOnlyField()
    preco_medio_geral = serializers.ReadOnlyField()
    total_seguidores = serializers.SerializerMethodField()

    class Meta:
        model = Place
        fields = ['id', 'place_id', 'nome', 'endereco', 'latitude', 'longitude',
                  'foto_capa', 'seguranca_media', 'preco_medio_geral', 'total_seguidores']

    def get_total_seguidores(self, obj):
        return obj.seguidores.count()

    def get_foto_capa(self, obj):
        from .services import montar_url_foto_google
        primeira_foto_itinerario = obj.pontos_itinerario.filter(
            itinerario__status='publicado'
        ).exclude(
            fotos__isnull=True
        ).first()
        if primeira_foto_itinerario and primeira_foto_itinerario.fotos.exists():
            request = self.context.get('request')
            foto = primeira_foto_itinerario.fotos.first().imagem
            return request.build_absolute_uri(foto.url) if request else foto.url
        return montar_url_foto_google(obj.foto_referencia_google)