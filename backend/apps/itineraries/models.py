from django.core.validators import MinValueValidator, MaxValueValidator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import models

# Create your models here.

class Itinerario(models.Model):
    autor = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=False)
    titulo = models.CharField(max_length=100)
    itinerario_original = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='forks')
    hashtags = models.ManyToManyField('social.Hashtag', blank=True, related_name='itinerarios')

    TIPO_CHOICES = [
        ('day_trip', 'Day Trip'),
        ('multi_day', 'Multi-Day Trip'),
    ]
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES, default='day_trip')

    STATUS_CHOICES = [
        ('rascunho', 'Rascunho'),
        ('publicado', 'Publicado'),
    ]
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='rascunho')

    data_inicio = models.DateField(null=True, blank=True)
    data_fim = models.DateField(null=True, blank=True)
    publicado_em = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.titulo

class PontoItinerario(models.Model):
    itinerario = models.ForeignKey('itineraries.Itinerario', on_delete=models.CASCADE, related_name='pontos')
    local = models.ForeignKey('places.Place', on_delete=models.CASCADE, related_name='pontos_itinerario')
    ordem = models.PositiveIntegerField(validators=[MinValueValidator(1)])

    movimentacao = models.CharField(max_length=20, choices=[
        ('vazio', 'Vazio'), ('populado', 'Populado'), ('cheio', 'Cheio')
    ], blank=True)
    seguranca = models.PositiveSmallIntegerField(
        null=True, blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    entrada_gratuita = models.BooleanField(default=False)
    preco_medio = models.PositiveSmallIntegerField(
        null=True, blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    distancia_ate_proximo = models.FloatField(null=True, blank=True)
    MEIO_DESLOCAMENTO_CHOICES = [
        ('a_pe', 'A pé'),
        ('carro', 'Carro'),
        ('taxi_app', 'Táxi/App de transporte'),
        ('transporte_publico', 'Transporte público'),
        ('bicicleta', 'Bicicleta'),
    ]
    meio_deslocamento = models.CharField(
        max_length=20, choices=MEIO_DESLOCAMENTO_CHOICES, blank=True
    )
    horario_estimado = models.TimeField(null=True, blank=True)
    comentario = models.TextField(blank=True)

    class Meta:
        ordering = ['itinerario', 'ordem']
        constraints = [
            models.UniqueConstraint(fields=['itinerario', 'ordem'], name='ordem_unica_por_itinerario')
        ]

    def clean(self):
        if self.entrada_gratuita and self.preco_medio is not None:
            raise DjangoValidationError("Local gratuito não deve ter avaliação de preço.")
        if not self.entrada_gratuita and self.preco_medio is None:
            raise DjangoValidationError("Informe a avaliação de preço, ou marque como entrada gratuita.")

    def __str__(self):
        return f"{self.itinerario.titulo} — {self.local.nome} (#{self.ordem})"

class FotoPontoItinerario(models.Model):
    ponto = models.ForeignKey('itineraries.PontoItinerario', on_delete=models.CASCADE, related_name='fotos')
    imagem = models.ImageField(upload_to='itinerarios/fotos/')
    enviada_em = models.DateTimeField(auto_now_add=True)

class VideoPontoItinerario(models.Model):
    """Vídeo de um ponto do itinerário. O arquivo enviado pelo usuário entra
    direto no campo `video` com status='processando'; a task Celery
    (apps.itineraries.tasks.comprimir_video_ponto_task) troca esse arquivo
    pela versão comprimida, gera a thumbnail e marca status='pronto' — ou
    'erro', se a compressão falhar (arquivo original já foi validado antes
    via ffprobe, então erro aqui é caso raro, não erro de usuário)."""

    STATUS_CHOICES = [
        ('processando', 'Processando'),
        ('pronto', 'Pronto'),
        ('erro', 'Erro'),
    ]

    ponto = models.ForeignKey('itineraries.PontoItinerario', on_delete=models.CASCADE, related_name='videos')
    video = models.FileField(upload_to='itinerarios/videos/')
    thumbnail = models.ImageField(upload_to='itinerarios/videos/thumbs/', null=True, blank=True)
    duracao_segundos = models.PositiveIntegerField(null=True, blank=True)
    tamanho_bytes = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='processando')
    erro_detalhe = models.CharField(max_length=500, blank=True)
    enviado_em = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Vídeo de {self.ponto} ({self.status})"


class ItinerarioSalvo(models.Model):
    usuario = models.ForeignKey(
        'users.User', on_delete=models.CASCADE,
        related_name='itinerarios_salvos'
    )
    itinerario = models.ForeignKey(
        'itineraries.Itinerario', on_delete=models.CASCADE,
        related_name='salvos_por'
    )
    salvo_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['usuario', 'itinerario'],
                name='salvo_unico_por_usuario'
            )
        ]

    def __str__(self):
        return f"{self.usuario.username} salvou {self.itinerario.titulo}"


class ItinerarioBaixado(models.Model):
    usuario = models.ForeignKey(
        'users.User', on_delete=models.CASCADE,
        related_name='itinerarios_baixados'
    )
    itinerario = models.ForeignKey(
        'itineraries.Itinerario', on_delete=models.CASCADE,
        related_name='baixados_por'
    )
    baixado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['usuario', 'itinerario'],
                name='baixado_unico_por_usuario'
            )
        ]

# ─── Extração automática de hashtags ──────────────────────────────────────────

import re
from django.db.models.signals import post_save
from django.dispatch import receiver


def extrair_hashtags(texto):
    """Extrai tokens de hashtag de um texto. Ex: '#viagem incrível #natureza' → ['viagem', 'natureza']"""
    return [m.lower() for m in re.findall(r'#([a-zA-ZÀ-ÿ0-9_]+)', texto)]


def sincronizar_hashtags_itinerario(itinerario):
    """Lê os comentários de todos os pontos do itinerário, extrai hashtags
    e sincroniza o M2M — criando Hashtags novas se necessário."""
    from apps.social.models import Hashtag

    nomes = set()
    for ponto in itinerario.pontos.all():
        nomes.update(extrair_hashtags(ponto.comentario))

    hashtags = []
    for nome in nomes:
        obj, _ = Hashtag.objects.get_or_create(nome=nome)
        hashtags.append(obj)

    itinerario.hashtags.set(hashtags)


@receiver(post_save, sender='itineraries.PontoItinerario')
def atualizar_hashtags_ao_salvar_ponto(sender, instance, **kwargs):
    """Sempre que um PontoItinerario é salvo, ressincroniza as hashtags do itinerário pai."""
    sincronizar_hashtags_itinerario(instance.itinerario)