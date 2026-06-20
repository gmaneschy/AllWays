from rest_framework.routers import DefaultRouter
from .views import FollowViewSet, MessageViewSet, CommentViewSet, HashtagViewSet

router = DefaultRouter()
router.register('follows', FollowViewSet)
router.register('messages', MessageViewSet)
router.register('comments', CommentViewSet)
router.register('hashtags', HashtagViewSet)

urlpatterns = router.urls