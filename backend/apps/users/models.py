from django.contrib.auth.models import AbstractUser
from django.db import models

# Create your models here.

class User(AbstractUser):
    foto_perfil = models.ImageField(upload_to='perfil/', null=True, blank=True)
    bio = models.CharField(max_length=200, blank=True)
    badge_destaque = models.ForeignKey('gamification.BadgeUsuario', on_delete=models.SET_NULL, null=True, blank=True, related_name='usuarios_com_destaque')

    class Meta:
        db_table = 'users'