from rest_framework.routers import DefaultRouter
from .views import ItinerarioViewSet, FotoPontoItinerarioViewSet

router = DefaultRouter()
router.register('itinerarios', ItinerarioViewSet)
router.register('fotos', FotoPontoItinerarioViewSet)

urlpatterns = router.urls