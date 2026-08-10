from django.contrib.auth.tokens import PasswordResetTokenGenerator


class GeradorTokenAtivacao(PasswordResetTokenGenerator):
    """Token de ativação de conta — reaproveita a lógica de assinatura e
    expiração do PasswordResetTokenGenerator do Django (mesmo mecanismo do
    "esqueci minha senha", trocando só o "sal" pra não colidir/ser
    intercambiável com tokens de outros fluxos).

    A validade do token é controlada pela mesma configuração global
    PASSWORD_RESET_TIMEOUT (settings.py) usada no reset de senha — se
    quiser um prazo diferente pra ativação, dá pra sobrescrever
    `timeout` aqui depois.

    Importante: o hash usa só pk/password/timestamp — de propósito NÃO
    inclui is_active. A checagem de ativação (GET /ativar/...) precisa
    continuar válida mesmo depois que a conta já foi ativada, porque a
    mesma URL pode ser batida mais de uma vez de forma legítima: efeito
    duplo do React StrictMode em dev, o usuário clicando o link duas
    vezes, ou scanners de segurança de provedores de e-mail corporativos
    (ex.: Outlook Safe Links) que pré-visitam o link antes do clique real
    do usuário. Se o hash mudasse com is_active, a segunda visita sempre
    falharia com "link inválido" mesmo sendo a mesma pessoa/token —
    a view (AtivarContaView) já é escrita pra ser idempotente por conta
    disso.
    """
    key_salt = 'apps.users.tokens.GeradorTokenAtivacao'

    def _make_hash_value(self, user, timestamp):
        return f'{user.pk}{user.password}{timestamp}'


gerador_token_ativacao = GeradorTokenAtivacao()