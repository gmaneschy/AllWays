from django.db import models

# Create your models here.

class BadgeItinerario(models.Model):
    """Selo escolhido pelo próprio autor ao criar o post."""
    nome = models.CharField(max_length=50)
    icone = models.ImageField(upload_to='badges/itinerario/')


class BadgeUsuario(models.Model):
    """Selo concedido pela plataforma com base no comportamento do usuário."""
    nome = models.CharField(max_length=50)
    icone = models.ImageField(upload_to='badges/usuario/')
    criterio = models.CharField(max_length=50)


class ItinerarioBadge(models.Model):
    """Relação: qual badge o autor escolheu para aquele itinerário."""
    itinerario = models.ForeignKey('itineraries.Itinerario', on_delete=models.CASCADE)
    badge = models.ForeignKey('gamification.BadgeItinerario', on_delete=models.CASCADE)


class UsuarioBadge(models.Model):
    """Relação: quais badges o usuário já conquistou."""
    usuario = models.ForeignKey('users.User', on_delete=models.CASCADE)
    badge = models.ForeignKey('gamification.BadgeUsuario', on_delete=models.CASCADE)
    conquistado_em = models.DateTimeField(auto_now_add=True)