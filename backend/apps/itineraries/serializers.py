from django.utils import timezone
from rest_framework import serializers
from .models import Itinerario, PontoItinerario, FotoPontoItinerario
from . import services as itinerario_services


class PontoItinerarioSerializer(serializers.ModelSerializer):
    local_nome = serializers.CharField(source='local.nome', read_only=True)

    class Meta:
        model = PontoItinerario
        fields = [
            'id', 'local', 'local_nome', 'ordem',
            'movimentacao', 'seguranca',
            'entrada_gratuita', 'preco_medio',
            'distancia_ate_proximo', 'meio_deslocamento',
            'horario_estimado', 'comentario',
        ]
        read_only_fields = ['distancia_ate_proximo']

    def validate(self, data):
        if data.get('entrada_gratuita') and data.get('preco_medio'):
            raise serializers.ValidationError(
                "Local gratuito não deve ter avaliação de preço."
            )
        if not data.get('entrada_gratuita') and data.get('preco_medio') is None:
            raise serializers.ValidationError(
                "Informe a avaliação de preço, ou marque como entrada gratuita."
            )
        return data


class ItinerarioSerializer(serializers.ModelSerializer):
    pontos = PontoItinerarioSerializer(many=True)
    autor_nome = serializers.CharField(source='autor.username', read_only=True)

    class Meta:
        model = Itinerario
        fields = [
            'id', 'autor', 'autor_nome', 'titulo', 'tipo', 'status',
            'data_inicio', 'data_fim', 'publicado_em',
            'itinerario_original', 'pontos',
        ]
        read_only_fields = ['autor', 'publicado_em']

    def validate_pontos(self, value):
        if len(value) == 0:
            raise serializers.ValidationError("O itinerário precisa de pelo menos 1 local.")
        return value

    def validate_data_inicio(self, value):
        if value and value > timezone.now().date():
            raise serializers.ValidationError("A data do itinerário não pode ser no futuro.")
        return value

    def create(self, validated_data):
        pontos_data = validated_data.pop('pontos')

        if validated_data.get('status') == 'publicado':
            validated_data['publicado_em'] = timezone.now()

        itinerario = Itinerario.objects.create(**validated_data)

        for ponto_data in pontos_data:
            PontoItinerario.objects.create(itinerario=itinerario, **ponto_data)

        itinerario_services.calcular_distancias_itinerario(itinerario)
        return itinerario


class FotoPontoItinerarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = FotoPontoItinerario
        fields = ['id', 'ponto', 'imagem', 'enviada_em']
        read_only_fields = ['enviada_em']

class FotoPontoDetalheSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = FotoPontoItinerario
        fields = ['id', 'url', 'enviada_em']

    def get_url(self, obj):
        request = self.context.get('request')
        return request.build_absolute_uri(obj.imagem.url) if request else obj.imagem.url


class PontoDetalheSerializer(serializers.ModelSerializer):
    local_nome = serializers.CharField(source='local.nome', read_only=True)
    local_endereco = serializers.CharField(source='local.endereco', read_only=True)
    local_id = serializers.IntegerField(source='local.id', read_only=True)
    fotos = FotoPontoDetalheSerializer(many=True, read_only=True)

    class Meta:
        model = PontoItinerario
        fields = [
            'id', 'ordem', 'local_id', 'local_nome', 'local_endereco',
            'movimentacao', 'seguranca', 'entrada_gratuita', 'preco_medio',
            'distancia_ate_proximo', 'meio_deslocamento', 'horario_estimado',
            'comentario', 'fotos',
        ]


class ItinerarioDetalheSerializer(serializers.ModelSerializer):
    pontos = PontoDetalheSerializer(many=True, read_only=True)
    autor_username = serializers.CharField(source='autor.username', read_only=True)
    autor_foto = serializers.SerializerMethodField()
    salvo_por_mim = serializers.SerializerMethodField()

    class Meta:
        model = Itinerario
        fields = [
            'id', 'titulo', 'tipo', 'status', 'data_inicio', 'data_fim',
            'publicado_em', 'autor', 'autor_username', 'autor_foto',
            'salvo_por_mim', 'pontos',
        ]

    def get_autor_foto(self, obj):
        request = self.context.get('request')
        if obj.autor and obj.autor.foto_perfil:
            return request.build_absolute_uri(obj.autor.foto_perfil.url) if request else obj.autor.foto_perfil.url
        return None

    def get_salvo_por_mim(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.salvos_por.filter(usuario=request.user).exists()