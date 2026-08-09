from django.conf import settings
from django.contrib import admin
from django.utils.html import format_html
from .models import Follow, Message, Comment, Hashtag, Denuncia

# Register your models here.

@admin.register(Denuncia)
class DenunciaAdmin(admin.ModelAdmin):
    """list_display aqui não é estilo — é necessidade: um `admin.site.register`
    simples (como os de baixo) só mostra o `__str__` do objeto na listagem,
    uma coluna só. Pra mostrar url do itinerário, dono, motivo, usuário e
    data como colunas separadas, precisa de um ModelAdmin com list_display."""
    list_display = ('itinerario_link', 'dono_itinerario', 'motivo', 'detalhe', 'usuario', 'criado_em')

    @admin.display(description='Itinerário (url)')
    def itinerario_link(self, obj):
        # FRONTEND_URL é opcional: se não configurado, cai pro caminho
        # relativo mesmo (funciona se o admin estiver no mesmo domínio do
        # front; se não estiver, defina FRONTEND_URL em settings.py).
        #base_url = getattr(settings, 'FRONTEND_URL', '').rstrip('/')
        base_url = "http://localhost:5173"
        url = f'{base_url}/itinerario/{obj.itinerario_id}'
        return format_html('<a href="{}" target="_blank">{}</a>', url, url)

    @admin.display(description='Dono do itinerário')
    def dono_itinerario(self, obj):
        return obj.itinerario.autor.username if obj.itinerario.autor_id else '—'

admin.site.register(Follow)
admin.site.register(Message)
admin.site.register(Comment)
admin.site.register(Hashtag)