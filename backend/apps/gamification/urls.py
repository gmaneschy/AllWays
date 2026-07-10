from django.urls import path
from .views import BadgeItinerarioListView, MinhasConquistasView

urlpatterns = [
    path('badges-itinerario/', BadgeItinerarioListView.as_view(), name='badges-itinerario'),
    path('minhas-conquistas/', MinhasConquistasView.as_view(), name='minhas-conquistas'),
]