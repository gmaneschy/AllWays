from django.db import models
from django.utils import timezone


class FeedEvent(models.Model):
    """Registra cada interação do usuário com um itinerário.
    É a fonte primária de dados para o algoritmo de recomendação.
    Não registra dwell time por ora — será adicionado futuramente."""

    TIPO_CHOICES = [
        ('view', 'Visualizou'),
        ('comment_read', 'Leu comentários'),
        ('save', 'Salvou'),
        ('use_as_base', 'Usou como base'),
        ('comment_post', 'Comentou'),
    ]

    usuario = models.ForeignKey(
        'users.User', on_delete=models.CASCADE,
        related_name='feed_events'
    )
    itinerario = models.ForeignKey(
        'itineraries.Itinerario', on_delete=models.CASCADE,
        related_name='feed_events'
    )
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    criado_em = models.DateTimeField(auto_now_add=True)

    # Peso de cada tipo de evento — usado no cálculo de interesse
    PESO = {
        'view': 1,
        'comment_read': 2,
        'save': 5,
        'use_as_base': 8,
        'comment_post': 4,
    }

    class Meta:
        indexes = [
            models.Index(fields=['usuario', 'tipo', 'criado_em']),
            models.Index(fields=['itinerario', 'tipo']),
        ]

    def __str__(self):
        return f"{self.usuario.username} → {self.tipo} → {self.itinerario.titulo}"


class UserInterestProfile(models.Model):
    """Perfil de interesse calculado para um usuário.
    Armazena scores normalizados por hashtag e por lugar,
    recalculados periodicamente pelo Celery."""

    usuario = models.OneToOneField(
        'users.User', on_delete=models.CASCADE,
        related_name='interest_profile'
    )
    # JSON: {"nome_hashtag": score_float, ...}  ex: {"natureza": 0.85, "museu": 0.4}
    hashtag_scores = models.JSONField(default=dict)
    # JSON: {"place_id_int": score_float, ...}
    lugar_scores = models.JSONField(default=dict)
    atualizado_em = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Interesses de {self.usuario.username}"


class UserSimilarity(models.Model):
    """Par de usuários com score de similaridade calculado via Jaccard
    sobre os itinerários que ambos salvaram.
    Recalculado diariamente pelo Celery."""

    usuario_a = models.ForeignKey(
        'users.User', on_delete=models.CASCADE,
        related_name='similaridades_como_a'
    )
    usuario_b = models.ForeignKey(
        'users.User', on_delete=models.CASCADE,
        related_name='similaridades_como_b'
    )
    # Jaccard similarity: |A ∩ B| / |A ∪ B|, entre 0 e 1
    score = models.FloatField()
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['usuario_a', 'usuario_b'],
                name='similaridade_unica_por_par'
            )
        ]
        indexes = [
            models.Index(fields=['usuario_a', 'score']),
        ]

    def __str__(self):
        return f"{self.usuario_a.username} ↔ {self.usuario_b.username}: {self.score:.2f}"


class FeedCache(models.Model):
    """Feed pré-calculado por usuário. Armazena os IDs dos itinerários
    ordenados por score, para servir rapidamente sem recalcular a cada request."""

    usuario = models.OneToOneField(
        'users.User', on_delete=models.CASCADE,
        related_name='feed_cache'
    )
    # Lista de IDs de itinerários ordenados por score: [42, 7, 13, ...]
    itinerario_ids = models.JSONField(default=list)
    gerado_em = models.DateTimeField(auto_now=True)

    def esta_fresco(self, ttl_minutes=30):
        """Retorna True se o cache foi gerado nos últimos ttl_minutes minutos."""
        idade = timezone.now() - self.gerado_em
        return idade.total_seconds() < ttl_minutes * 60

    def __str__(self):
        return f"Feed cache de {self.usuario.username} ({len(self.itinerario_ids)} itens)"