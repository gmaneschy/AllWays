from rest_framework import serializers
from .models import BadgeItinerario, BadgeUsuario, UsuarioBadge


class BadgeItinerarioSerializer(serializers.ModelSerializer):
    """Catálogo de badges de itinerário (caro, econômico, relaxante etc.) —
    usado na criação/edição de itinerário e na exibição em feed/perfil/explorar."""
    class Meta:
        model = BadgeItinerario
        fields = ['id', 'nome', 'icone']


class BadgeUsuarioSerializer(serializers.ModelSerializer):
    """Um nível de badge de usuário — usado como badge_destaque exibida ao lado do nome."""
    tipo_nome = serializers.CharField(source='tipo.nome', read_only=True)

    class Meta:
        model = BadgeUsuario
        fields = ['id', 'nome', 'icone', 'nivel', 'tipo_nome']


class MinhaConquistaSerializer(serializers.ModelSerializer):
    """Uma conquista (UsuarioBadge) do usuário logado — alimenta o modal de
    seleção de badge_destaque no perfil."""
    badge = BadgeUsuarioSerializer(read_only=True)

    class Meta:
        model = UsuarioBadge
        fields = ['id', 'badge', 'contexto', 'conquistado_em']


def serializar_badge_destaque(usuario, context=None):
    """Ponto único de decisão sobre exibir ou não a badge_destaque de um usuário
    em contextos PÚBLICOS (feed, post, comentário de itinerário, comentário de
    lugar). Respeita o toggle 'exibir_badges' das configurações do usuário.

    Não usar isso na tela de configurações/edição do próprio perfil — lá o
    usuário deve sempre ver e poder gerenciar sua própria badge_destaque,
    independente do toggle (senão não conseguiria reativar depois)."""
    if usuario is None or not usuario.exibir_badges or not usuario.badge_destaque_id:
        return None
    return BadgeUsuarioSerializer(usuario.badge_destaque, context=context or {}).data