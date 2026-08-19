import math
import re
from datetime import date, timedelta

from django.utils import timezone
from rest_framework import serializers
from apps.itineraries.models import Itinerario, ItinerarioSalvo, ItinerarioBaixado
from apps.gamification.models import UsuarioBadge
from apps.gamification.serializers import (
    BadgeItinerarioSerializer, BadgeUsuarioSerializer, serializar_badge_destaque,
)
from .models import User


USERNAME_REGEX = re.compile(r'^[a-z][a-z0-9_.]{2,19}$')
IDADE_MINIMA = 13
COOLDOWN_DIAS_NOME_EXIBICAO = 15


def dias_restantes_cooldown_nome(usuario):
    """Quantos dias faltam até o usuário poder trocar o nome_exibicao de novo.
    0 significa 'livre para trocar agora' (nunca trocou, ou o prazo já passou)."""
    if not usuario.nome_exibicao_alterado_em:
        return 0
    decorrido = timezone.now() - usuario.nome_exibicao_alterado_em
    restante = timedelta(days=COOLDOWN_DIAS_NOME_EXIBICAO) - decorrido
    if restante.total_seconds() <= 0:
        return 0
    return math.ceil(restante.total_seconds() / 86400)


class CadastroSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    # Declarados explicitamente como obrigatórios: o model tem 'default' (só
    # para evitar prompt do makemigrations ao recriar o banco), mas no
    # cadastro real esses dados sempre devem vir preenchidos pelo usuário.
    username = serializers.CharField(max_length=20)
    nome_exibicao = serializers.CharField(max_length=50)
    genero = serializers.ChoiceField(choices=User.Genero.choices)
    data_nascimento = serializers.DateField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'nome_exibicao', 'email', 'password',
            'genero', 'data_nascimento',
        ]

    def validate_username(self, value):
        value = value.strip().lower()
        if not USERNAME_REGEX.match(value):
            raise serializers.ValidationError(
                'Use de 3 a 20 caracteres: comece com uma letra e use apenas '
                'letras minúsculas, números, "." ou "_".'
            )
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('Este nome de usuário já está em uso.')
        return value

    def validate_email(self, value):
        # O model herdado de AbstractUser não tem unique=True em 'email' —
        # sem essa checagem aqui, dava pra criar várias contas com o mesmo
        # e-mail (inclusive o de outra pessoa, só pra spammar ela de
        # e-mails de ativação). Case-insensitive pra evitar
        # "nome@x.com" vs "Nome@X.com" contando como diferentes.
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('Este e-mail já está associado a uma conta.')
        return value

    def validate_nome_exibicao(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Informe um nome de exibição.')
        return value

    def validate_data_nascimento(self, value):
        if value > date.today():
            raise serializers.ValidationError('Data de nascimento não pode estar no futuro.')
        idade = (date.today() - value).days // 365
        if idade < IDADE_MINIMA:
            raise serializers.ValidationError(
                f'É necessário ter ao menos {IDADE_MINIMA} anos para se cadastrar.'
            )
        return value

    def create(self, validated_data):
        # is_active=False: a conta só é liberada pra login depois que o
        # usuário clica no link de ativação recebido por e-mail (ver
        # CadastroView.perform_create / AtivarContaView).
        return User.objects.create_user(**validated_data, is_active=False)


class ReenviarAtivacaoSerializer(serializers.Serializer):
    """Usado em POST /users/ativar/reenviar/. Só valida o formato do
    e-mail — a existência (ou não) da conta é tratada na view, que
    devolve sempre a mesma mensagem genérica pra não permitir
    enumeração de contas por e-mail."""
    email = serializers.EmailField()


class MeSerializer(serializers.ModelSerializer):
    """Visão PRIVADA do próprio usuário — sempre mostra a badge_destaque real
    e o estado do toggle, independente de 'exibir_badges' (é a tela de gestão,
    não a exibição pública)."""
    badge_destaque = BadgeUsuarioSerializer(read_only=True)
    dias_para_trocar_nome_exibicao = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'nome_exibicao', 'email', 'bio', 'foto_perfil',
            'genero', 'data_nascimento', 'badge_destaque', 'exibir_badges',
            'dias_para_trocar_nome_exibicao',
        ]

    def get_dias_para_trocar_nome_exibicao(self, obj):
        return dias_restantes_cooldown_nome(obj)


class EditarPerfilSerializer(serializers.ModelSerializer):
    """PATCH em /users/me/perfil/. Cobre nome_exibicao (com cooldown de
    15 dias), bio e foto_perfil — todos parciais: só valida/atualiza o que
    vier no payload. foto_perfil já é opcional/nullable no model, então o
    DRF a trata como not required automaticamente."""

    class Meta:
        model = User
        fields = ['nome_exibicao', 'bio', 'foto_perfil']

    def validate_nome_exibicao(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Informe um nome de exibição.')

        usuario = self.instance
        if usuario and value != usuario.nome_exibicao:
            dias_restantes = dias_restantes_cooldown_nome(usuario)
            if dias_restantes > 0:
                raise serializers.ValidationError(
                    f'Você poderá trocar o nome de exibição novamente em '
                    f'{dias_restantes} dia{"s" if dias_restantes != 1 else ""}.'
                )
        return value

    def update(self, instance, validated_data):
        novo_nome = validated_data.get('nome_exibicao', instance.nome_exibicao)
        if novo_nome != instance.nome_exibicao:
            instance.nome_exibicao_alterado_em = timezone.now()
        return super().update(instance, validated_data)


class ConfiguracoesSerializer(serializers.ModelSerializer):
    """Serializer dedicado às configurações de conta: privacidade, notificações
    e exibição. Tudo em um único endpoint (PATCH parcial) — a tela de
    Configurações manda só o(s) campo(s) que o usuário mexeu."""
    class Meta:
        model = User
        fields = [
            'exibir_badges',
            'conta_privada',
            'notif_seguiu', 'notif_comentou', 'notif_respondeu', 'notif_novo_post',
            'ocultar_seguidores', 'ocultar_seguindo', 'ocultar_lugares_seguidos',
        ]


class AlterarSenhaSerializer(serializers.Serializer):
    """Usado em PATCH /users/me/senha/. Exige a senha atual (evita que
    alguém com uma sessão aberta na máquina de outra pessoa troque a senha
    sem saber a original) e aplica os validators padrão do Django na nova."""
    senha_atual = serializers.CharField(write_only=True)
    nova_senha = serializers.CharField(write_only=True, min_length=8)

    def validate_senha_atual(self, value):
        usuario = self.context['request'].user
        if not usuario.check_password(value):
            raise serializers.ValidationError('Senha atual incorreta.')
        return value

    def validate_nova_senha(self, value):
        from django.contrib.auth.password_validation import validate_password
        validate_password(value, user=self.context['request'].user)
        return value

    def save(self):
        usuario = self.context['request'].user
        usuario.set_password(self.validated_data['nova_senha'])
        usuario.save(update_fields=['password'])
        return usuario


class DesativarContaSerializer(serializers.Serializer):
    """Usado em POST /users/me/desativar/. Exige a senha (mesma lógica de
    AlterarSenhaSerializer: evita desativação por sessão aberta esquecida).
    duracao_dias null/omitido = desativação indefinida, só reativa fazendo
    login de novo; 7/15/30 = reativa sozinha depois desse prazo (login
    antes também reativa — ver User.reativar() e auth_serializers.py)."""
    DURACOES_VALIDAS = (7, 15, 30)

    senha = serializers.CharField(write_only=True)
    duracao_dias = serializers.IntegerField(required=False, allow_null=True, default=None)

    def validate_senha(self, value):
        usuario = self.context['request'].user
        if not usuario.check_password(value):
            raise serializers.ValidationError('Senha incorreta.')
        return value

    def validate_duracao_dias(self, value):
        if value is not None and value not in self.DURACOES_VALIDAS:
            raise serializers.ValidationError(
                'Duração inválida. Use 7, 15, 30 ou não informe (indefinida).'
            )
        return value

    def save(self):
        usuario = self.context['request'].user
        duracao = self.validated_data.get('duracao_dias')
        usuario.conta_desativada_em = timezone.now()
        usuario.conta_desativada_ate = (
            timezone.now() + timedelta(days=duracao) if duracao else None
        )
        usuario.save(update_fields=['conta_desativada_em', 'conta_desativada_ate'])
        return usuario


class ExcluirContaSerializer(serializers.Serializer):
    """Usado em POST /users/me/excluir/. Senha + confirmação explícita —
    a tela de Configurações é responsável pelo diálogo "tem certeza?" antes
    de sequer chamar esse endpoint. Soft-delete: ver User.conta_excluida_em
    e tasks.expurgar_conta_excluida para o expurgo definitivo."""
    senha = serializers.CharField(write_only=True)
    confirmar = serializers.BooleanField()

    def validate_senha(self, value):
        usuario = self.context['request'].user
        if not usuario.check_password(value):
            raise serializers.ValidationError('Senha incorreta.')
        return value

    def validate_confirmar(self, value):
        if not value:
            raise serializers.ValidationError('É necessário confirmar a exclusão da conta.')
        return value

    def save(self):
        usuario = self.context['request'].user
        usuario.conta_excluida_em = timezone.now()
        usuario.is_active = False
        usuario.save(update_fields=['conta_excluida_em', 'is_active'])

        from .tasks import expurgar_conta_excluida
        PERIODO_CARENCIA_SEGUNDOS = 60 * 60 * 24 * 30  # 30 dias
        expurgar_conta_excluida.apply_async(args=[usuario.id], countdown=PERIODO_CARENCIA_SEGUNDOS)
        return usuario


class ItinerarioResumoSerializer(serializers.ModelSerializer):
    """Versão compacta para listar no perfil — sem pontos aninhados.
    'primeira_midia' e 'total_pontos' alimentam a miniatura do grid no
    front (CardItinerarioResumo) — mesma lógica usada em ExplorarView e
    HashtagFeedView (apps/social/views.py); requer que o queryset de
    origem tenha prefetch_related('pontos__fotos', 'pontos__videos'),
    senão isso vira uma query extra por itinerário."""
    badges_detalhe = serializers.SerializerMethodField()
    total_pontos = serializers.SerializerMethodField()
    primeira_midia = serializers.SerializerMethodField()

    class Meta:
        model = Itinerario
        fields = [
            'id', 'titulo', 'tipo', 'status', 'data_inicio', 'publicado_em',
            'badges_detalhe', 'total_pontos', 'primeira_midia',
        ]

    def get_badges_detalhe(self, obj):
        from apps.gamification.models import BadgeItinerario
        ids = obj.badges.values_list('badge_id', flat=True)
        badges = BadgeItinerario.objects.filter(id__in=ids)
        return BadgeItinerarioSerializer(badges, many=True, context=self.context).data

    def get_total_pontos(self, obj):
        return obj.pontos.count()

    def get_primeira_midia(self, obj):
        request = self.context.get('request')
        for ponto in obj.pontos.all():
            foto = next(iter(ponto.fotos.all()), None)
            if foto:
                return {
                    'tipo': 'foto',
                    'url': request.build_absolute_uri(foto.imagem.url) if request else foto.imagem.url,
                    'thumbnail_url': None,
                    'status': None,
                }
            video = next(iter(ponto.videos.all()), None)
            if video:
                return {
                    'tipo': 'video',
                    'url': (request.build_absolute_uri(video.video.url) if request else video.video.url) if video.video else None,
                    'thumbnail_url': (request.build_absolute_uri(video.thumbnail.url) if request else video.thumbnail.url) if video.thumbnail else None,
                    'status': video.status,
                }
        return None


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
    solicitado = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'nome_exibicao', 'bio', 'foto_perfil', 'badge_destaque',
            'conta_privada', 'total_seguidores', 'total_seguindo_usuarios', 'total_seguindo_lugares',
            'itinerarios_publicados', 'badges', 'voce_segue', 'solicitado',
        ]

    def get_badge_destaque(self, obj):
        return serializar_badge_destaque(obj, context=self.context)

    def get_total_seguidores(self, obj):
        if self._oculto_para_visitante(obj, 'ocultar_seguidores'):
            return None
        return obj.seguidores.count()

    def get_total_seguindo_usuarios(self, obj):
        if self._oculto_para_visitante(obj, 'ocultar_seguindo'):
            return None
        return obj.seguindo.filter(seguido_usuario__isnull=False).count()

    def get_total_seguindo_lugares(self, obj):
        if self._oculto_para_visitante(obj, 'ocultar_lugares_seguidos'):
            return None
        return obj.seguindo.filter(seguido_local__isnull=False).count()

    def _oculto_para_visitante(self, obj, campo):
        """True quando o visitante não deveria ver esse número. Duas regras
        independentes, qualquer uma delas basta pra ocultar:
        1) o toggle específico (ocultar_seguidores/ocultar_seguindo/
           ocultar_lugares_seguidos) está ligado;
        2) a conta é privada e o visitante não é seguidor aprovado dela
           (uma SolicitacaoSeguir pendente não conta como aprovado).
        O dono sempre vê os números reais na própria página, independente
        de qualquer uma das duas regras."""
        request = self.context.get('request')
        dono_esta_vendo = bool(
            request and request.user.is_authenticated and request.user == obj
        )
        if dono_esta_vendo:
            return False

        if obj.conta_privada:
            eh_seguidor = bool(
                request and request.user.is_authenticated
                and obj.seguidores.filter(seguidor=request.user).exists()
            )
            if not eh_seguidor:
                return True

        return bool(getattr(obj, campo))

    def get_itinerarios_publicados(self, obj):
        if not self._pode_ver_conteudo(obj):
            return []
        qs = Itinerario.objects.filter(autor=obj, status='publicado').prefetch_related('pontos__fotos', 'pontos__videos')
        return ItinerarioResumoSerializer(qs, many=True, context=self.context).data

    def _pode_ver_conteudo(self, obj):
        """Conta pública: todo mundo vê os itinerários. Conta privada: só o
        dono e quem já está aprovado como seguidor (Follow real — uma
        SolicitacaoSeguir pendente ainda não dá acesso)."""
        if not obj.conta_privada:
            return True
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        if request.user == obj:
            return True
        return obj.seguidores.filter(seguidor=request.user).exists()

    def get_badges(self, obj):
        qs = obj.badges.select_related('badge', 'badge__tipo').order_by('badge__tipo__nome', 'badge__criterio_valor')
        return BadgeResumoSerializer(qs, many=True, context=self.context).data

    def get_voce_segue(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated or request.user == obj:
            return None
        return obj.seguidores.filter(seguidor=request.user).exists()

    def get_solicitado(self, obj):
        """True quando o visitante tem uma SolicitacaoSeguir pendente pra essa
        conta privada — front usa isso pra mostrar 'Solicitado' em vez de 'Seguir'."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated or request.user == obj:
            return False
        from apps.social.models import SolicitacaoSeguir
        return SolicitacaoSeguir.objects.filter(solicitante=request.user, alvo=obj).exists()


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
        qs = Itinerario.objects.filter(autor=obj, status='rascunho').prefetch_related('pontos__fotos', 'pontos__videos')
        return ItinerarioResumoSerializer(qs, many=True, context=self.context).data

    def get_salvos(self, obj):
        qs = Itinerario.objects.filter(
            salvos_por__usuario=obj
        ).select_related('autor').prefetch_related('pontos__fotos', 'pontos__videos')
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