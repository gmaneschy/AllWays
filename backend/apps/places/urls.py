from django.urls import path
from .views import AutocompletePlaceView, CriarOuBuscarPlaceView, PlaceDetailView

urlpatterns = [
    path('autocomplete/', AutocompletePlaceView.as_view(), name='places-autocomplete'),
    path('<int:pk>/detalhe/', PlaceDetailView.as_view(), name='places-detail'),
    path('', CriarOuBuscarPlaceView.as_view(), name='places-create'),
]