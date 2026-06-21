from django.db import models
from django.db.models import Avg

# Create your models here.

class Place(models.Model):
    place_id = models.CharField(max_length=255, unique=True)
    nome = models.CharField(max_length=200)
    endereco = models.CharField(max_length=300, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    foto_referencia_google = models.CharField(max_length=300, null=True, blank=True)

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