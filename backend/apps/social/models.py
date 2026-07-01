from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import models
from django.db.models import Q, F


class Follow(models.Model):
    """Um Follow aponta para exatamente UM alvo: usuário, local ou hashtag.
    Nunca zero, nunca mais de um — garantido pela constraint 'alvo_unico_follow'."""

    seguidor = models.ForeignKey(
        'users.User', on_delete=models.CASCADE,
        related_name='seguindo'
    )
    seguido_usuario = models.ForeignKey(
        'users.User', on_delete=models.CASCADE, null=True, blank=True,
        related_name='seguidores'
    )
    seguido_local = models.ForeignKey(
        'places.Place', on_delete=models.CASCADE, null=True, blank=True,
        related_name='seguidores'
    )
    seguido_hashtag = models.ForeignKey(
        'social.Hashtag', on_delete=models.CASCADE, null=True, blank=True,
        related_name='seguidores'
    )
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            # Garante que exatamente um dos três alvos está preenchido (não zero, não mais de um)
            models.CheckConstraint(
                name='alvo_unico_follow',
                check=(
                    (Q(seguido_usuario__isnull=False) & Q(seguido_local__isnull=True) & Q(seguido_hashtag__isnull=True)) |
                    (Q(seguido_usuario__isnull=True) & Q(seguido_local__isnull=False) & Q(seguido_hashtag__isnull=True)) |
                    (Q(seguido_usuario__isnull=True) & Q(seguido_local__isnull=True) & Q(seguido_hashtag__isnull=False))
                )
            ),
            # Impede duplicata: mesmo seguidor seguindo o mesmo alvo mais de uma vez.
            # Como NULL não conta como igual em UniqueConstraint no Postgres,
            # isso funciona corretamente mesmo com os outros dois campos sendo NULL.
            models.UniqueConstraint(
                fields=['seguidor', 'seguido_usuario'],
                name='seguidor_usuario_unico',
                condition=Q(seguido_usuario__isnull=False),
            ),
            models.UniqueConstraint(
                fields=['seguidor', 'seguido_local'],
                name='seguidor_local_unico',
                condition=Q(seguido_local__isnull=False),
            ),
            models.UniqueConstraint(
                fields=['seguidor', 'seguido_hashtag'],
                name='seguidor_hashtag_unico',
                condition=Q(seguido_hashtag__isnull=False),
            ),
            # Impede auto-follow a nível de banco também (defesa em profundidade —
            # a view/serializer já bloqueia isso, mas charges diretas no banco passariam sem isso)
            models.CheckConstraint(
                name='nao_pode_seguir_a_si_mesmo',
                check=~Q(seguidor=F('seguido_usuario')),
            ),
        ]

    def clean(self):
        alvos_preenchidos = sum([
            self.seguido_usuario_id is not None,
            self.seguido_local_id is not None,
            self.seguido_hashtag_id is not None,
        ])
        if alvos_preenchidos != 1:
            raise DjangoValidationError(
                "Um Follow deve apontar para exatamente um alvo: usuário, local ou hashtag."
            )
        if self.seguido_usuario_id is not None and self.seguido_usuario_id == self.seguidor_id:
            raise DjangoValidationError("Você não pode seguir a si mesmo.")

    def __str__(self):
        alvo = self.seguido_usuario or self.seguido_local or self.seguido_hashtag
        return f"{self.seguidor.username} segue {alvo}"


class Message(models.Model):
    remetente = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True,
        related_name='mensagens_enviadas'
    )
    destinatario = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True,
        related_name='mensagens_recebidas'
    )
    texto = models.TextField()
    enviada_em = models.DateTimeField(auto_now_add=True)


class Comment(models.Model):
    """Comentário social em um POST (itinerário) de outro usuário —
    não confundir com PontoItinerario.comentario, que é a nota do autor
    sobre um local específico durante a construção do itinerário."""
    autor = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=False
    )
    itinerario = models.ForeignKey(
        'itineraries.Itinerario', on_delete=models.CASCADE,
        related_name='comentarios'
    )
    texto = models.TextField()
    criado_em = models.DateTimeField(auto_now_add=True)


class Hashtag(models.Model):
    nome = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return f"#{self.nome}"