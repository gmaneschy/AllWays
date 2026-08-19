from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class LoginSerializer(TokenObtainPairSerializer):
    """Usado por users.views.LoginView no lugar do TokenObtainPairSerializer
    padrão. A validação de usuário/senha em si continua sendo feita pelo
    super().validate() (inclusive a checagem de is_active do Django) — aqui
    só entra a regra extra de desativação/exclusão:

    - conta excluída: login sempre bloqueado (soft-delete é irreversível
      pro usuário; se precisar reverter é via suporte, não pelo login).
    - conta desativada (timed ou indefinida): login autentica normalmente
      e REATIVA a conta na hora — é o comportamento "até logar de novo"
      pedido pra desativação indefinida, e vale pra timed também (logar
      antes do prazo simplesmente encerra a desativação mais cedo)."""

    def validate(self, attrs):
        data = super().validate(attrs)
        usuario = self.user

        if usuario.esta_excluida:
            raise serializers.ValidationError(
                'Esta conta foi excluída.', code='conta_excluida'
            )

        if usuario.esta_desativada:
            usuario.reativar()

        return data
