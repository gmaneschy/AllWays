from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import models
from django.db.models import Q, F


class Follow(models.Model):
    """Um Follow aponta para exatamente UM alvo: usuário ou local.
    Follow de hashtag foi removido — hashtags são pesquisáveis mas não seguíveis."""

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
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                name='alvo_unico_follow',
                check=(
                    (Q(seguido_usuario__isnull=False) & Q(seguido_local__isnull=True)) |
                    (Q(seguido_usuario__isnull=True) & Q(seguido_local__isnull=False))
                )
            ),
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
            models.CheckConstraint(
                name='nao_pode_seguir_a_si_mesmo',
                check=~Q(seguidor=F('seguido_usuario')),
            ),
        ]

    def clean(self):
        alvos_preenchidos = sum([
            self.seguido_usuario_id is not None,
            self.seguido_local_id is not None,
        ])
        if alvos_preenchidos != 1:
            raise DjangoValidationError(
                "Um Follow deve apontar para exatamente um alvo: usuário ou local."
            )
        if self.seguido_usuario_id is not None and self.seguido_usuario_id == self.seguidor_id:
            raise DjangoValidationError("Você não pode seguir a si mesmo.")

    def __str__(self):
        alvo = self.seguido_usuario or self.seguido_local
        return f"{self.seguidor.username} segue {alvo}"


class Message(models.Model):
    TIPO_CHOICES = [
        ('texto', 'Texto'),
        ('imagem', 'Imagem'),
        ('audio', 'Áudio'),
        ('video', 'Vídeo'),
        ('itinerario', 'Itinerário'),
    ]
    VIDEO_STATUS_CHOICES = [
        ('processando', 'Processando'),
        ('pronto', 'Pronto'),
        ('erro', 'Erro'),
    ]
    remetente = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True,
        related_name='mensagens_enviadas'
    )
    destinatario = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True,
        related_name='mensagens_recebidas'
    )
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES, default='texto')
    texto = models.TextField(blank=True)
    imagem = models.ImageField(upload_to='mensagens/imagens/', null=True, blank=True)
    audio = models.FileField(upload_to='mensagens/audios/', null=True, blank=True)
    # Vídeo segue o mesmo padrão assíncrono do VideoPontoItinerario: o arquivo
    # enviado entra com video_status='processando' e a task Celery
    # (apps.social.tasks.comprimir_video_mensagem_task) troca pelo comprimido
    # + gera a thumbnail.
    video = models.FileField(upload_to='mensagens/videos/', null=True, blank=True)
    video_thumbnail = models.ImageField(upload_to='mensagens/videos/thumbs/', null=True, blank=True)
    video_status = models.CharField(max_length=12, choices=VIDEO_STATUS_CHOICES, blank=True)
    duracao_segundos = models.PositiveIntegerField(null=True, blank=True)
    itinerario = models.ForeignKey(
        'itineraries.Itinerario', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='mensagens_compartilhado'
    )
    enviada_em = models.DateTimeField(auto_now_add=True)

    def clean(self):
        if self.tipo == 'texto' and not self.texto.strip():
            raise DjangoValidationError("Mensagem de texto não pode ser vazia.")
        if self.tipo == 'imagem' and not self.imagem:
            raise DjangoValidationError("Mensagem de imagem requer um arquivo de imagem.")
        if self.tipo == 'audio' and not self.audio:
            raise DjangoValidationError("Mensagem de áudio requer um arquivo de áudio.")
        if self.tipo == 'video' and not self.video:
            raise DjangoValidationError("Mensagem de vídeo requer um arquivo de vídeo.")
        if self.tipo == 'itinerario' and not self.itinerario_id:
            raise DjangoValidationError("Mensagem de itinerário requer um itinerário vinculado.")


class Comment(models.Model):
    """Comentário social em um itinerário — puramente social, não agrega dados.

    Threading estilo Instagram, 1 nível só:
    - `parent` sempre aponta pro comentário RAIZ da thread (nunca pra uma resposta).
      É o que agrupa visualmente "comentário + suas respostas".
    - `responder_para` é o usuário especificamente mencionado por essa resposta
      (pode ser o autor do comentário raiz, OU alguém que respondeu depois dele
      dentro da mesma thread — daí o "@fulano @beltrano" na prática do Instagram).
      É esse campo, não o autor do `parent`, que decide quem recebe a notificação
      de "respondeu seu comentário"."""
    autor = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=False
    )
    itinerario = models.ForeignKey(
        'itineraries.Itinerario', on_delete=models.CASCADE,
        related_name='comentarios'
    )
    texto = models.TextField()
    criado_em = models.DateTimeField(auto_now_add=True)
    parent = models.ForeignKey(
        'self', on_delete=models.CASCADE, null=True, blank=True,
        related_name='respostas',
    )
    responder_para = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='comentarios_mencionado_em',
    )

    def clean(self):
        if self.parent_id and self.parent.parent_id:
            raise DjangoValidationError(
                "Respostas não podem ter mais de um nível — aponte `parent` "
                "sempre para o comentário raiz da thread, e use `responder_para` "
                "para indicar quem está sendo respondido dentro dela."
            )


class Hashtag(models.Model):
    nome = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return f"#{self.nome}"


class Curtida(models.Model):
    """Curtida genérica, reaproveitada nos 4 contextos: post (Itinerario),
    comentário de post (Comment), comentário de lugar (PontoItinerario.comentario,
    exibido só na página do Place) e mensagem (Message).

    Usa o framework de ContentType do Django em vez de 4 tabelas quase-idênticas.
    A view que cria Curtida SEMPRE valida contra uma whitelist de (app_label, model)
    — o cliente nunca escolhe o ContentType livremente."""

    usuario = models.ForeignKey(
        'users.User', on_delete=models.CASCADE,
        related_name='curtidas'
    )
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    alvo = GenericForeignKey('content_type', 'object_id')
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['usuario', 'content_type', 'object_id'],
                name='curtida_unica_por_usuario_e_alvo',
            )
        ]
        indexes = [
            models.Index(fields=['content_type', 'object_id']),
        ]

    def __str__(self):
        return f"{self.usuario.username} curtiu {self.alvo}"


class Notification(models.Model):
    """Notificação genérica — mesmo framework de ContentType da Curtida.
    `alvo` é pra onde o clique na notificação deve levar:
    - follow            → perfil de `ator`
    - comentario        → o Itinerario comentado
    - resposta_comentario → o Comment respondido (ou o Itinerario, se preferir linkar pra thread)
    - mensagem          → a Message (frontend resolve pra conversa com `ator`)
    - curtida           → o que foi curtido (Itinerario, Comment, PontoItinerario ou Message)

    Assim como na Curtida, a view que cria Notification SEMPRE valida contra uma
    whitelist de (app_label, model) — nunca aceita ContentType livre do cliente
    (mas aqui isso nem é exposto: Notification só é criada via signal/task,
    nunca por request direto do usuário)."""

    TIPO_CHOICES = [
        ('follow', 'Novo seguidor'),
        ('comentario', 'Comentário no seu post'),
        ('resposta_comentario', 'Resposta ao seu comentário'),
        ('mensagem', 'Nova mensagem'),
        ('curtida', 'Curtida'),
    ]

    destinatario = models.ForeignKey(
        'users.User', on_delete=models.CASCADE,
        related_name='notificacoes'
    )
    ator = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True,
        related_name='notificacoes_geradas'
    )
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, null=True, blank=True)
    object_id = models.PositiveIntegerField(null=True, blank=True)
    alvo = GenericForeignKey('content_type', 'object_id')
    lida = models.BooleanField(default=False)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-criado_em']
        indexes = [
            models.Index(fields=['destinatario', 'lida', '-criado_em']),
        ]

    def __str__(self):
        return f"[{self.tipo}] para {self.destinatario.username}"