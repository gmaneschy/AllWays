from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import ItinerarioViewSet, FotoPontoItinerarioViewSet
from apps.users.views import SalvarItinerarioView, BaixarItinerarioView

router = DefaultRouter()
router.register('itinerarios', ItinerarioViewSet)
router.register('fotos', FotoPontoItinerarioViewSet)

urlpatterns = router.urls + [
    path('itinerarios/<int:pk>/salvar/', SalvarItinerarioView.as_view(), name='salvar-itinerario'),
    path('itinerarios/<int:pk>/baixar/', BaixarItinerarioView.as_view(), name='baixar-itinerario'),
]