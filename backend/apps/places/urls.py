from django.urls import path
from .views import AutocompletePlaceView, CriarOuBuscarPlaceView

urlpatterns = [
    path('autocomplete/', AutocompletePlaceView.as_view(), name='places-autocomplete'),
    path('', CriarOuBuscarPlaceView.as_view(), name='places-create'),
]