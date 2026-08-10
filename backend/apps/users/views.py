from django.shortcuts import get_object_or_404
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import generics, permissions, status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework.response import Response
from apps.itineraries.models import ItinerarioSalvo, ItinerarioBaixado, Itinerario
from .models import User
from .serializers import (
    CadastroSerializer, MeSerializer, ConfiguracoesSerializer,
    PerfilPublicoSerializer, PerfilProprioSerializer,
    SelecionarBadgeDestaqueSerializer, EditarPerfilSerializer,
    AlterarSenhaSerializer, ReenviarAtivacaoSerializer,
)
from .tasks import enviar_email_ativacao
from .tokens import gerador_token_ativacao


class ThrottleCadastro(AnonRateThrottle):
    scope = 'cadastro'


class ThrottleReenvioAtivacao(AnonRateThrottle):
    scope = 'reenvio_ativacao'


class CadastroView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = CadastroSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ThrottleCadastro]

    def perform_create(self, serializer):
        usuario = serializer.save()
        enviar_email_ativacao.delay(usuario.id)


class AtivarContaView(APIView):
    """GET /api/users/ativar/<uidb64>/<token>/
    Chamada pela página de ativação do front, que extrai uidb64/token da
    URL recebida por e-mail. Idempotente: ativar uma conta já ativa
    simplesmente confirma sucesso de novo, sem erro."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, uidb64, token):
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            usuario = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, UnicodeDecodeError, User.DoesNotExist):
            usuario = None

        if usuario is None or not gerador_token_ativacao.check_token(usuario, token):
            return Response(
                {'detail': 'Link de ativação inválido ou expirado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not usuario.is_active:
            usuario.is_active = True
            usuario.save(update_fields=['is_active'])

        return Response({'ativado': True})


class ReenviarAtivacaoView(APIView):
    """POST /api/users/ativar/reenviar/  body: {email}
    Resposta sempre genérica (não revela se o e-mail existe, se já está
    ativo, etc.) — evita enumeração de contas via esse endpoint."""
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ThrottleReenvioAtivacao]

    MENSAGEM_GENERICA = (
        'Se o e-mail informado tiver uma conta pendente de ativação, '
        'enviamos um novo link.'
    )

    def post(self, request):
        serializer = ReenviarAtivacaoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        usuario = User.objects.filter(email__iexact=email, is_active=False).first()
        if usuario:
            enviar_email_ativacao.delay(usuario.id)

        return Response({'detail': self.MENSAGEM_GENERICA})


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = MeSerializer(request.user, context={'request': request})
        return Response(serializer.data)


class EditarPerfilView(APIView):
    """PATCH /api/users/me/perfil/
    Edição de nome_exibicao (respeitando cooldown de 15 dias), bio e
    foto_perfil. Badge tem endpoint próprio."""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def patch(self, request):
        serializer = EditarPerfilSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(MeSerializer(request.user, context={'request': request}).data)


class ConfiguracoesView(APIView):
    """GET/PATCH /api/users/me/configuracoes/
    Preferências de conta. Hoje só 'exibir_badges', mas o endpoint fica
    genérico pra receber outras configurações futuras sem quebrar o contrato."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(ConfiguracoesSerializer(request.user).data)

    def patch(self, request):
        serializer = ConfiguracoesSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class AlterarSenhaView(APIView):
    """PATCH /api/users/me/senha/  body: {senha_atual, nova_senha}
    Troca a senha exigindo confirmação da senha atual. Não desloga as outras
    sessões/tokens já emitidos — se isso vier a importar, dá pra invalidar
    refresh tokens ativos aqui depois."""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request):
        serializer = AlterarSenhaSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'ok': True})


class SelecionarBadgeDestaqueView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request):
        serializer = SelecionarBadgeDestaqueSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        request.user.badge_destaque_id = serializer.validated_data['badge_id']
        request.user.save(update_fields=['badge_destaque'])

        return Response(MeSerializer(request.user, context={'request': request}).data)


class PerfilView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, username):
        usuario = get_object_or_404(User, username=username)

        if request.user.is_authenticated and request.user == usuario:
            serializer = PerfilProprioSerializer(usuario, context={'request': request})
        else:
            serializer = PerfilPublicoSerializer(usuario, context={'request': request})

        return Response(serializer.data)


class SalvarItinerarioView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        itinerario = get_object_or_404(Itinerario, pk=pk, status='publicado')
        salvo, criado = ItinerarioSalvo.objects.get_or_create(
            usuario=request.user, itinerario=itinerario
        )
        if not criado:
            salvo.delete()
            return Response({'salvo': False})
        return Response({'salvo': True}, status=status.HTTP_201_CREATED)


class BaixarItinerarioView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        itinerario = get_object_or_404(Itinerario, pk=pk, status='publicado')
        ItinerarioBaixado.objects.get_or_create(usuario=request.user, itinerario=itinerario)
        ItinerarioSalvo.objects.get_or_create(usuario=request.user, itinerario=itinerario)
        return Response({'baixado': True})