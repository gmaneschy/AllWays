from django.contrib import admin
from .models import BadgeItinerario, TipoBadgeUsuario, BadgeUsuario, ItinerarioBadge, UsuarioBadge


@admin.register(BadgeItinerario)
class BadgeItinerarioAdmin(admin.ModelAdmin):
    list_display = ['nome']


class BadgeUsuarioInline(admin.TabularInline):
    model = BadgeUsuario
    extra = 1


@admin.register(TipoBadgeUsuario)
class TipoBadgeUsuarioAdmin(admin.ModelAdmin):
    list_display = ['nome', 'descricao']
    inlines = [BadgeUsuarioInline]


@admin.register(BadgeUsuario)
class BadgeUsuarioAdmin(admin.ModelAdmin):
    list_display = ['nome', 'tipo', 'nivel', 'criterio_campo', 'criterio_valor']
    list_filter = ['tipo', 'nivel', 'criterio_campo']


@admin.register(UsuarioBadge)
class UsuarioBadgeAdmin(admin.ModelAdmin):
    list_display = ['usuario', 'badge', 'contexto', 'conquistado_em']
    list_filter = ['badge__tipo']
    search_fields = ['usuario__username', 'contexto']