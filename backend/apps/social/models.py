from django.db import models

# Create your models here.

class Follow(models.Model):
    seguidor = models.ForeignKey(
        'users.User', on_delete=models.CASCADE,
        related_name='seguindo'
    )
    seguido_usuario = models.ForeignKey(
        'users.User', on_delete=models.CASCADE, null=True,
        related_name='seguidores'
    )
    seguido_local = models.ForeignKey(
        'places.Place', on_delete=models.CASCADE, null=True
    )
    seguido_hashtag = models.ForeignKey(
        'social.Hashtag', on_delete=models.CASCADE, null=True
    )


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


class Hashtag(models.Model):
    nome = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return f"#{self.nome}"