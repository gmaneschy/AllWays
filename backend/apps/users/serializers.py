from rest_framework import serializers
from apps.itineraries.models import Itinerario, ItinerarioSalvo, ItinerarioBaixado
from apps.gamification.models import UsuarioBadge
from .models import User


class CadastroSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password']

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)

class MeSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'bio', 'foto_perfil']


class ItinerarioResumoSerializer(serializers.ModelSerializer):
    """Versão compacta para listar no perfil — sem pontos aninhados."""
    class Meta:
        model = Itinerario
        fields = ['id', 'titulo', 'tipo', 'status', 'data_inicio', 'publicado_em']


class BadgeResumoSerializer(serializers.ModelSerializer):
    nome = serializers.CharField(source='badge.nome')
    icone = serializers.ImageField(source='badge.icone')

    class Meta:
        model = UsuarioBadge
        fields = ['nome', 'icone', 'conquistado_em']


class PerfilPublicoSerializer(serializers.ModelSerializer):
    """Perfil de qualquer usuário — visível a todos."""
    total_seguidores = serializers.SerializerMethodField()
    total_seguindo = serializers.SerializerMethodField()
    itinerarios_publicados = serializers.SerializerMethodField()
    badges = BadgeResumoSerializer(source='usuariobadge_set', many=True, read_only=True)
    voce_segue = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'bio', 'foto_perfil', 'badge_destaque',
            'total_seguidores', 'total_seguindo',
            'itinerarios_publicados', 'badges', 'voce_segue',
        ]

    def get_total_seguidores(self, obj):
        return obj.seguidores.count()

    def get_total_seguindo(self, obj):
        return obj.seguindo.count()

    def get_itinerarios_publicados(self, obj):
        qs = Itinerario.objects.filter(autor=obj, status='publicado')
        return ItinerarioResumoSerializer(qs, many=True).data

    def get_voce_segue(self, obj):
        """Se há um usuário autenticado fazendo a requisição (que não seja
        o próprio dono do perfil), indica se ele já segue este usuário.
        Retorna None quando não há usuário logado ou é o próprio perfil —
        o frontend usa isso para decidir se mostra o botão de seguir."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated or request.user == obj:
            return None
        return obj.seguidores.filter(seguidor=request.user).exists()


class PerfilProprioSerializer(PerfilPublicoSerializer):
    """Extensão do perfil público — só visível para o próprio usuário logado."""
    rascunhos = serializers.SerializerMethodField()
    salvos = serializers.SerializerMethodField()

    class Meta(PerfilPublicoSerializer.Meta):
        fields = PerfilPublicoSerializer.Meta.fields + ['rascunhos', 'salvos', 'email']

    def get_rascunhos(self, obj):
        qs = Itinerario.objects.filter(autor=obj, status='rascunho')
        return ItinerarioResumoSerializer(qs, many=True).data

    def get_salvos(self, obj):
        qs = Itinerario.objects.filter(
            salvos_por__usuario=obj
        ).select_related('autor')
        return ItinerarioResumoSerializer(qs, many=True).data