from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import generics, permissions, status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from apps.itineraries.models import ItinerarioSalvo, ItinerarioBaixado, Itinerario
from .models import User
from .serializers import (
    CadastroSerializer, MeSerializer, ConfiguracoesSerializer,
    PerfilPublicoSerializer, PerfilProprioSerializer,
    SelecionarBadgeDestaqueSerializer, EditarPerfilSerializer,
    AlterarSenhaSerializer, ReenviarAtivacaoSerializer,
    DesativarContaSerializer, ExcluirContaSerializer,
)
from .auth_serializers import LoginSerializer
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


class LoginView(TokenObtainPairView):
    """POST /api/auth/login/
    Substitui o TokenObtainPairView padrão do simplejwt: bloqueia login de
    contas excluídas e reativa automaticamente contas desativadas (timed ou
    indefinidas) que fizerem login com sucesso. Ver auth_serializers.LoginSerializer.

    IMPORTANTE: troque a view apontada em 'auth/login/' (config/urls.py, ou
    onde esse endpoint estiver registrado hoje) para esta aqui — senão o
    comportamento de desativação/exclusão não é respeitado no login."""
    serializer_class = LoginSerializer


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


class DesativarContaView(APIView):
    """POST /api/users/me/desativar/  body: {senha, duracao_dias?}
    duracao_dias omitido/null = indefinida (só reativa com novo login);
    7, 15 ou 30 = reativa sozinha depois desse prazo (login antes também
    reativa, ver auth_serializers.LoginSerializer)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = DesativarContaSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({
            'desativada': True,
            'desativada_ate': request.user.conta_desativada_ate,
        })


class ExcluirContaView(APIView):
    """POST /api/users/me/excluir/  body: {senha, confirmar: true}
    Soft-delete imediato (perfil, comentários, mensagens e itinerários somem
    pros outros usuários na hora); o expurgo definitivo dos dados roda em
    background depois do período de carência — ver ExcluirContaSerializer."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ExcluirContaSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'excluida': True})


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
        dono_esta_vendo = request.user.is_authenticated and request.user == usuario

        # Perfil de conta desativada/excluída fica invisível pra qualquer um
        # que não seja o próprio dono — mesmo comportamento de "não existe"
        # que um username incorreto teria, pra não vazar se a conta existe.
        if not dono_esta_vendo and not usuario.esta_visivel:
            raise Http404

        if dono_esta_vendo:
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