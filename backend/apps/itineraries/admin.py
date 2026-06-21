from django.contrib import admin
from .models import Itinerario, PontoItinerario, FotoPontoItinerario

# Register your models here.

class PontoItinerarioInline(admin.TabularInline):
    model = PontoItinerario
    extra = 1  # quantos formulários vazios extras aparecem para adicionar novos pontos


class ItinerarioAdmin(admin.ModelAdmin):
    inlines = [PontoItinerarioInline]


admin.site.register(Itinerario, ItinerarioAdmin)
admin.site.register(PontoItinerario)
admin.site.register(FotoPontoItinerario)