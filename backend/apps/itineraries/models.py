from django.db import models

# Create your models here.

class Itinerario(models.Model):
    autor = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True, blank=False
    )
    titulo = models.CharField(max_length=100)
    itinerario_original = models.ForeignKey(
        'self', null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='forks'
    )

    def __str__(self):
        return self.titulo