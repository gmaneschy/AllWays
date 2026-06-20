from rest_framework.routers import DefaultRouter
from .views import ItinerarioViewSet

router = DefaultRouter()
router.register('itinerarios', ItinerarioViewSet)

urlpatterns = router.urls