from modeltranslation.translator import register, TranslationOptions
from .models import BadgeItinerario, BadgeUsuario, TipoBadgeUsuario

@register(BadgeItinerario)
class BadgeItinerarioTranslationOptions(TranslationOptions):
    fields = ('nome',)

@register(BadgeUsuario)
class BadgeUsuarioTranslationOptions(TranslationOptions):
    fields = ('nome',)

@register(TipoBadgeUsuario)
class TipoBadgeUsuarioTranslationOptions(TranslationOptions):
    fields = ('nome', 'descricao')