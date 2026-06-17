from .models import BadgeItinerario, BadgeUsuario, ItinerarioBadge, UsuarioBadge
from django.contrib import admin

# Register your models here.

admin.site.register(BadgeItinerario)
admin.site.register(BadgeUsuario)
admin.site.register(ItinerarioBadge)
admin.site.register(UsuarioBadge)