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
    ordem = models.PositiveIntegerField()

    movimentacao = models.CharField(max_length=20, choices=[
        ('vazio', 'Vazio'), ('populado', 'Populado'), ('cheio', 'Cheio')
    ], blank=True)
    seguranca = models.PositiveSmallIntegerField(null=True, blank=True)
    preco_medio = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    distancia_ate_proximo = models.FloatField(null=True, blank=True)
    meio_deslocamento = models.CharField(max_length=20, blank=True)
    horario_estimado = models.TimeField(null=True, blank=True)
    comentario = models.TextField(blank=True)

    class Meta:
        ordering = ['itinerario', 'ordem']

    def __str__(self):
        return f"{self.itinerario.titulo} — {self.local.nome} (#{self.ordem})"