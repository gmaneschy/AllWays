from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.html import escape
from django.utils.http import urlsafe_base64_encode

from .models import User
from .tokens import gerador_token_ativacao


@shared_task
def enviar_email_ativacao(user_id):
    """Idempotente: se o usuário já ativou a conta (ou foi removido) entre o
    disparo e a execução da task, não faz nada — evita mandar e-mail de
    ativação pra quem já está ativo (ex.: reenvio em corrida com a ativação
    manual do link anterior)."""
    try:
        usuario = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return

    if usuario.is_active:
        return

    uidb64 = urlsafe_base64_encode(force_bytes(usuario.pk))
    token = gerador_token_ativacao.make_token(usuario)
    link_ativacao = f'{settings.FRONTEND_URL}/ativar-conta/{uidb64}/{token}'
    nome = usuario.nome_exibicao or usuario.username

    # Corpo em texto puro (fallback pra clientes sem suporte a HTML). O
    # link fica isolado numa linha própria, mas ainda corre risco de ser
    # quebrado por soft line-breaks de quoted-printable (o corpo tem
    # acento, então o Django codifica em QP, que quebra linhas > ~76
    # caracteres — e o link sozinho já passa disso). Por isso a versão
    # HTML abaixo é a que realmente importa: um <a href> não depende de
    # o cliente reconstruir a URL certinho a partir de texto quebrado.
    corpo_texto = (
        f'Olá, {nome}!\n\n'
        f'Para ativar sua conta, acesse o link abaixo:\n{link_ativacao}\n\n'
        f'Se você não criou essa conta, é só ignorar este e-mail.'
    )

    corpo_html = f"""
      <p>Olá, {escape(nome)}!</p>
      <p>Para ativar sua conta, clique no botão abaixo:</p>
      <p>
        <a href="{escape(link_ativacao)}"
           style="display:inline-block;padding:10px 20px;background:#2e7d32;
                  color:#ffffff;text-decoration:none;border-radius:6px;">
          Ativar minha conta
        </a>
      </p>
      <p>Ou copie e cole este link no navegador:<br>
        <a href="{escape(link_ativacao)}">{escape(link_ativacao)}</a>
      </p>
      <p style="color:#666;font-size:13px;">
        Se você não criou essa conta, é só ignorar este e-mail.
      </p>
    """

    email = EmailMultiAlternatives(
        subject='Ative sua conta no AllWays',
        body=corpo_texto,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[usuario.email],
    )
    email.attach_alternative(corpo_html, 'text/html')
    email.send(fail_silently=False)


@shared_task
def deletar_contas_nao_ativadas():
    """Task periódica (agendada no config/celery.py): remove contas que
    nunca foram ativadas e já passaram do prazo de graça
    (settings.CONTA_NAO_ATIVADA_EXPIRA_DIAS). Libera o username/e-mail
    pra reuso — sem isso, alguém que nunca confirma o e-mail "trava" esse
    username/e-mail pra sempre, já que CadastroSerializer bloqueia
    duplicidade independente do status de ativação."""
    limite = timezone.now() - timedelta(days=settings.CONTA_NAO_ATIVADA_EXPIRA_DIAS)
    User.objects.filter(is_active=False, date_joined__lt=limite).delete()


@shared_task
def expurgar_conta_excluida(usuario_id):
    """Agendada por ExcluirContaSerializer.save() pra rodar ~30 dias depois
    da exclusão (período de carência). Se a conta ainda estiver marcada como
    excluída nesse momento, apaga os dados de verdade — cascata do Django
    cuida de comentários, mensagens, itinerários etc. Se o usuário reativou
    via suporte nesse meio-tempo (conta_excluida_em voltou a null), a task
    não faz nada."""
    from .models import User

    usuario = User.objects.filter(id=usuario_id, conta_excluida_em__isnull=False).first()
    if not usuario:
        return
    usuario.delete()