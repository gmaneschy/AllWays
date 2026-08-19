from datetime import date

from django.contrib.auth.models import AbstractUser, UserManager as DjangoUserManager
from django.core.validators import RegexValidator
from django.db import models
from django.utils import timezone

# Create your models here.

username_validator = RegexValidator(
    regex=r'^[a-z][a-z0-9_.]{2,19}$',
    message=(
        'Use de 3 a 20 caracteres: comece com uma letra minúscula e use apenas '
        'letras minúsculas, números, "." ou "_".'
    ),
)


class UserQuerySet(models.QuerySet):
    def visiveis(self):
        """Exclui contas excluídas e contas atualmente desativadas (indefinidas,
        ou com prazo — enquanto o prazo não vencer). Usar sempre que for listar
        ou expor conteúdo de terceiros (perfil, comentários, mensagens,
        itinerários) pra quem não é o próprio dono da conta."""
        agora = timezone.now()
        return self.filter(conta_excluida_em__isnull=True).exclude(
            models.Q(conta_desativada_em__isnull=False) & (
                models.Q(conta_desativada_ate__isnull=True) |
                models.Q(conta_desativada_ate__gt=agora)
            )
        )


class UserManager(DjangoUserManager.from_queryset(UserQuerySet)):
    """Mantém tudo que o UserManager padrão do Django já fazia (create_user,
    create_superuser etc.) e soma o .visiveis() do UserQuerySet acima."""
    pass


class User(AbstractUser):
    class Genero(models.TextChoices):
        MASCULINO = 'M', 'Masculino'
        FEMININO = 'F', 'Feminino'
        OUTRO = 'O', 'Outro'
        NAO_INFORMAR = 'N', 'Prefiro não informar'

    objects = UserManager()

    # Sobrescreve o username herdado do AbstractUser: funciona como o "@" do
    # usuário (handle público, único, sempre minúsculo).
    username = models.CharField(
        max_length=20,
        unique=True,
        validators=[username_validator],
        help_text=(
            'Identificador público (@usuario): 3 a 20 caracteres, letras '
            'minúsculas, números, "." ou "_".'
        ),
        error_messages={'unique': 'Este nome de usuário já está em uso.'},
    )
    nome_exibicao = models.CharField(
        max_length=50,
        default='',
        help_text="Nome de exibição (pode ter espaços, acentos e maiúsculas).",
    )
    nome_exibicao_alterado_em = models.DateTimeField(
        null=True, blank=True,
        help_text="Data/hora da última troca de nome de exibição (controla o cooldown de 15 dias).",
    )
    genero = models.CharField(max_length=1, choices=Genero.choices, default=Genero.NAO_INFORMAR)
    data_nascimento = models.DateField(default=date(2000, 1, 1))
    foto_perfil = models.ImageField(upload_to='perfil/', null=True, blank=True)
    bio = models.CharField(max_length=200, blank=True)
    badge_destaque = models.ForeignKey(
        'gamification.BadgeUsuario', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='usuarios_com_destaque'
    )
    exibir_badges = models.BooleanField(
        default=True,
        help_text="Se desativado, oculta a badge de destaque no feed, posts e comentários (públicos)."
    )

    # --- Privacidade ---
    conta_privada = models.BooleanField(
        default=False,
        help_text=(
            "Se ativado, itinerários e conteúdo completo do perfil só ficam "
            "visíveis para quem segue; novos seguidores exigem aprovação manual."
        ),
    )

    # --- Notificações (todas ligadas por padrão) ---
    notif_seguiu = models.BooleanField(default=True, help_text='Notificar quando alguém seguir você.')
    notif_comentou = models.BooleanField(default=True, help_text='Notificar quando comentarem no seu post.')
    notif_respondeu = models.BooleanField(default=True, help_text='Notificar quando responderem seu comentário.')
    notif_mensagem = models.BooleanField(default=True, help_text='Notificar quando alguém enviar mensagem.')
    notif_novo_post = models.BooleanField(default=True, help_text='Notificar quando alguém que você segue publicar um novo itinerário.')

    # --- Exibição (oculta a MINHA lista; não afeta o que vejo da lista dos outros) ---
    ocultar_seguidores = models.BooleanField(default=False)
    ocultar_seguindo = models.BooleanField(default=False)
    ocultar_lugares_seguidos = models.BooleanField(default=False)

    # --- Desativação / exclusão de conta ---
    conta_desativada_em = models.DateTimeField(
        null=True, blank=True,
        help_text="Preenchido quando o usuário desativa a própria conta.",
    )
    conta_desativada_ate = models.DateTimeField(
        null=True, blank=True,
        help_text=(
            "Null = desativação indefinida (só reativa fazendo login de novo). "
            "Preenchida = reativa sozinha nesta data, mesmo sem login."
        ),
    )
    conta_excluida_em = models.DateTimeField(
        null=True, blank=True,
        help_text=(
            "Soft-delete: marca a conta como excluída (irreversível pro usuário). "
            "Os dados de verdade só são expurgados depois do período de carência "
            "— ver apps.users.tasks.expurgar_conta_excluida."
        ),
    )

    @property
    def esta_desativada(self):
        """True se a conta está desativada AGORA — considera o prazo, não só
        a presença de conta_desativada_em."""
        if not self.conta_desativada_em:
            return False
        if self.conta_desativada_ate and timezone.now() >= self.conta_desativada_ate:
            return False
        return True

    @property
    def esta_excluida(self):
        return self.conta_excluida_em is not None

    @property
    def esta_visivel(self):
        """Espelha UserQuerySet.visiveis() pra checagem em uma instância só
        (quando não dá pra usar o queryset, ex. dentro de um serializer)."""
        return not self.esta_excluida and not self.esta_desativada

    def reativar(self):
        """Chamado no login bem-sucedido (ver apps/users/auth_serializers.py).
        Idempotente — não faz nada se a conta já estava ativa."""
        if self.conta_desativada_em:
            self.conta_desativada_em = None
            self.conta_desativada_ate = None
            self.save(update_fields=['conta_desativada_em', 'conta_desativada_ate'])

    def save(self, *args, **kwargs):
        # Rede de segurança: garante minúsculo mesmo se o registro não passar
        # pelo CadastroSerializer (ex.: criado via admin ou shell).
        if self.username:
            self.username = self.username.lower()
        super().save(*args, **kwargs)

    class Meta:
        db_table = 'users'