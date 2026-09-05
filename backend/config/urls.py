"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
import mimetypes

from django.contrib import admin
from django.urls import path, re_path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenRefreshView
from apps.users.views import LoginView

# Registrado aqui (em vez de num AppConfig.ready()) porque é o ponto mais
# cedo e mais confiável de startup do projeto pra isso — mimetypes.guess_type
# é usado tanto pela serve_media_com_range abaixo quanto por qualquer storage
# real (S3 etc.) em produção, e o registro do Python nem sempre reconhece
# essas extensões por padrão (principalmente em imagens Docker enxutas),
# o que fazia o servidor mandar Content-Type: application/octet-stream e
# confundir o AVPlayer no iOS.
mimetypes.add_type('audio/mp4', '.m4a')
mimetypes.add_type('audio/webm', '.webm')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/places/', include('apps.places.urls')),
    path('api/social/', include('apps.social.urls')),
    path('api/itineraries/', include('apps.itineraries.urls')),
    path('api/feed/', include('apps.feed.urls')),
    path('api/users/', include('apps.users.urls')),
    path('api/gamification/', include('apps.gamification.urls')),
    path('api/auth/login/', LoginView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]

if settings.DEBUG:
    # Substitui o static() padrão do Django por uma view que suporta Range
    # requests (ver core/media_serve.py) — o static.serve original nunca
    # devolve 206, o que travava a reprodução de áudio/vídeo no AVPlayer
    # (iOS) direto da URL remota, sem baixar o arquivo antes.
    from core.media_serve import serve_media_com_range

    urlpatterns += [
        re_path(
            r'^%s(?P<path>.*)$' % settings.MEDIA_URL.lstrip('/'),
            serve_media_com_range,
            {'document_root': settings.MEDIA_ROOT},
        ),
    ]