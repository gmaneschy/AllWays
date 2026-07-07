from django.db import models
from django.db.models import Avg


class Place(models.Model):
    place_id = models.CharField(max_length=255, unique=True)
    nome = models.CharField(max_length=200)
    endereco = models.CharField(max_length=300, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    foto_referencia_google = models.CharField(max_length=300, null=True, blank=True)

    # ─── Dados geográficos estruturados (usados na gamificação) ──────────
    cidade = models.CharField(max_length=100, blank=True)
    regiao = models.CharField(max_length=100, blank=True)        # estado/província/cantão/etc.
    regiao_codigo = models.CharField(max_length=10, blank=True)   # ex: 'CE' (parte do ISO 3166-2 'BR-CE')
    pais = models.CharField(max_length=100, blank=True)
    pais_codigo = models.CharField(max_length=2, blank=True)       # ISO 3166-1 alpha-2
    continente = models.CharField(max_length=20, blank=True)

    CATEGORIA_CULTURAL = 'cultural'
    CATEGORIA_RELIGIOSO = 'religioso'
    CATEGORIA_GASTRONOMICO = 'gastronomico'
    CATEGORIA_OUTRO = 'outro'
    CATEGORIA_CHOICES = [
        (CATEGORIA_CULTURAL, 'Cultural'),
        (CATEGORIA_RELIGIOSO, 'Religioso'),
        (CATEGORIA_GASTRONOMICO, 'Gastronômico'),
        (CATEGORIA_OUTRO, 'Outro'),
    ]
    categoria_gamificacao = models.CharField(
        max_length=20, choices=CATEGORIA_CHOICES, default=CATEGORIA_OUTRO
    )

    @property
    def seguranca_media(self):
        return self.pontos_itinerario.filter(
            itinerario__status='publicado'
        ).aggregate(media=Avg('seguranca'))['media']

    @property
    def preco_medio_geral(self):
        return self.pontos_itinerario.filter(
            itinerario__status='publicado'
        ).aggregate(media=Avg('preco_medio'))['media']

    def __str__(self):
        return self.nome