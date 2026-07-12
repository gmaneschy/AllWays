from datetime import date

from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator
from django.db import models

# Create your models here.

username_validator = RegexValidator(
    regex=r'^[a-z][a-z0-9_.]{2,19}$',
    message=(
        'Use de 3 a 20 caracteres: comece com uma letra minúscula e use apenas '
        'letras minúsculas, números, "." ou "_".'
    ),
)


class User(AbstractUser):
    class Genero(models.TextChoices):
        MASCULINO = 'M', 'Masculino'
        FEMININO = 'F', 'Feminino'
        OUTRO = 'O', 'Outro'
        NAO_INFORMAR = 'N', 'Prefiro não informar'

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

    def save(self, *args, **kwargs):
        # Rede de segurança: garante minúsculo mesmo se o registro não passar
        # pelo CadastroSerializer (ex.: criado via admin ou shell).
        if self.username:
            self.username = self.username.lower()
        super().save(*args, **kwargs)

    class Meta:
        db_table = 'users'