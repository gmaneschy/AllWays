from django.core.validators import MinValueValidator, MaxValueValidator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import models

# Create your models here.

class Itinerario(models.Model):
    autor = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=False)
    titulo = models.CharField(max_length=100)
    itinerario_original = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='forks')

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