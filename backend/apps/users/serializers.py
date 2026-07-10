from rest_framework import serializers
from apps.itineraries.models import Itinerario, ItinerarioSalvo, ItinerarioBaixado
from apps.gamification.models import UsuarioBadge
from apps.gamification.serializers import (
    BadgeItinerarioSerializer, BadgeUsuarioSerializer, serializar_badge_destaque,
)
from .models import User


class CadastroSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password']

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class MeSerializer(serializers.ModelSerializer):
    """Visão PRIVADA do próprio usuário — sempre mostra a badge_destaque real
    e o estado do toggle, independente de 'exibir_badges' (é a tela de gestão,
    não a exibição pública)."""
    badge_destaque = BadgeUsuarioSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'bio', 'foto_perfil', 'badge_destaque', 'exibir_badges']


class ConfiguracoesSerializer(serializers.ModelSerializer):
    """Serializer dedicado às configurações de conta. Por ora só tem
    'exibir_badges', mas fica isolado aqui pra crescer sem inchar o MeSerializer."""
    class Meta:
        model = User
        fields = ['exibir_badges']


class ItinerarioResumoSerializer(serializers.ModelSerializer):
    """Versão compacta para listar no perfil — sem pontos aninhados."""
    badges_detalhe = serializers.SerializerMethodField()

    class Meta:
        model = Itinerario
        fields = ['id', 'titulo', 'tipo', 'status', 'data_inicio', 'publicado_em', 'badges_detalhe']

    def get_badges_detalhe(self, obj):
        from apps.gamification.models import BadgeItinerario
        ids = obj.badges.values_list('badge_id', flat=True)
        badges = BadgeItinerario.objects.filter(id__in=ids)
        return BadgeItinerarioSerializer(badges, many=True, context=self.context).data


class BadgeResumoSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='badge.id')
    nome = serializers.CharField(source='badge.nome')
    icone = serializers.ImageField(source='badge.icone')
    nivel = serializers.CharField(source='badge.nivel')
    tipo_nome = serializers.CharField(source='badge.tipo.nome')

    class Meta:
        model = UsuarioBadge
        fields = ['id', 'nome', 'icone', 'nivel', 'tipo_nome', 'contexto', 'conquistado_em']


class PerfilPublicoSerializer(serializers.ModelSerializer):
    """Perfil de qualquer usuário — visível a todos. Respeita 'exibir_badges':
    se o dono desativou, badge_destaque aparece como null pra qualquer visitante
    (inclusive o próprio dono vendo sua página pública, por consistência com o
    que os outros veem)."""
    total_seguidores = serializers.SerializerMethodField()
    total_seguindo_usuarios = serializers.SerializerMethodField()
    total_seguindo_lugares = serializers.SerializerMethodField()
    itinerarios_publicados = serializers.SerializerMethodField()
    badges = serializers.SerializerMethodField()
    badge_destaque = serializers.SerializerMethodField()
    voce_segue = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'bio', 'foto_perfil', 'badge_destaque',
            'total_seguidores', 'total_seguindo_usuarios', 'total_seguindo_lugares',
            'itinerarios_publicados', 'badges', 'voce_segue',
        ]

    def get_badge_destaque(self, obj):
        return serializar_badge_destaque(obj, context=self.context)

    def get_total_seguidores(self, obj):
        return obj.seguidores.count()

    def get_total_seguindo_usuarios(self, obj):
        return obj.seguindo.filter(seguido_usuario__isnull=False).count()

    def get_total_seguindo_lugares(self, obj):
        return obj.seguindo.filter(seguido_local__isnull=False).count()

    def get_itinerarios_publicados(self, obj):
        qs = Itinerario.objects.filter(autor=obj, status='publicado')
        return ItinerarioResumoSerializer(qs, many=True, context=self.context).data

    def get_badges(self, obj):
        qs = obj.badges.select_related('badge', 'badge__tipo').order_by('badge__tipo__nome', 'badge__criterio_valor')
        return BadgeResumoSerializer(qs, many=True, context=self.context).data

    def get_voce_segue(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated or request.user == obj:
            return None
        return obj.seguidores.filter(seguidor=request.user).exists()


class PerfilProprioSerializer(PerfilPublicoSerializer):
    """Extensão do perfil público — só visível para o próprio usuário logado.
    Mesmo sendo o dono olhando, mantém badge_destaque respeitando o toggle
    (é a mesma tela que 'PaginaPerfil.jsx' usa pra pré-visualizar o próprio
    perfil como os outros o veem; o modal de troca de badge usa 'minhas-conquistas'
    e o MeSerializer, que sempre mostram o valor real)."""
    rascunhos = serializers.SerializerMethodField()
    salvos = serializers.SerializerMethodField()

    class Meta(PerfilPublicoSerializer.Meta):
        fields = PerfilPublicoSerializer.Meta.fields + ['rascunhos', 'salvos', 'email']

    def get_rascunhos(self, obj):
        qs = Itinerario.objects.filter(autor=obj, status='rascunho')
        return ItinerarioResumoSerializer(qs, many=True, context=self.context).data

    def get_salvos(self, obj):
        qs = Itinerario.objects.filter(
            salvos_por__usuario=obj
        ).select_related('autor')
        return ItinerarioResumoSerializer(qs, many=True, context=self.context).data


class SelecionarBadgeDestaqueSerializer(serializers.Serializer):
    badge_id = serializers.IntegerField(allow_null=True)

    def validate_badge_id(self, value):
        if value is None:
            return value
        usuario = self.context['request'].user
        possui = UsuarioBadge.objects.filter(usuario=usuario, badge_id=value).exists()
        if not possui:
            raise serializers.ValidationError("Você ainda não conquistou este distintivo.")
        return value