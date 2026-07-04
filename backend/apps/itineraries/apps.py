from django.apps import AppConfig


class ItinerariesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.itineraries'

    def ready(self):
        import apps.itineraries.models  # noqa: F401 — registra os signals