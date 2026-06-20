from django.utils import timezone
from rest_framework import serializers
from .models import Itinerario, PontoItinerario
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
        read_only_fields = ['publicado_em']

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
        itinerario = Itinerario.objects.create(**validated_data)

        for ponto_data in pontos_data:
            PontoItinerario.objects.create(itinerario=itinerario, **ponto_data)

        itinerario_services.calcular_distancias_itinerario(itinerario)

        return itinerario