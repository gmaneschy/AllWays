from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from apps.places.services import calcular_distancia
from .models import PontoItinerario

# Campos do ponto que são livres no rascunho (por isso o model permite
# blank=True/null=True) mas passam a ser obrigatórios só no momento da
# publicação. horario_estimado e comentario ficam de fora de propósito.
CAMPOS_OBRIGATORIOS_PONTO = ['movimentacao', 'seguranca', 'meio_deslocamento']


def validar_itinerario_para_publicacao(itinerario):
    """Roda todas as checagens de "pronto pra publicar" e acumula os erros
    em vez de parar no primeiro — assim o autor corrige tudo de uma vez em
    vez de descobrir um problema por tentativa.

    Importante: mídia (foto/vídeo) só existe no banco DEPOIS que o
    itinerário e os pontos já foram criados (o frontend cria o itinerário,
    pega os IDs dos pontos e só então faz upload). Por isso essa validação
    não pode rodar dentro do ItinerarioSerializer.create() — precisa ser
    chamada depois, na transição rascunho → publicado (ver
    views.ItinerarioViewSet.publicar)."""
    erros = []

    if not itinerario.titulo:
        erros.append("Título é obrigatório.")

    # data_inicio/data_fim ficam null=True/blank=True no model de propósito
    # (rascunho não precisa de data) — a obrigatoriedade é só na publicação,
    # igual ao padrão já usado pros campos de PontoItinerario em
    # CAMPOS_OBRIGATORIOS_PONTO.
    if not itinerario.data_inicio:
        erros.append("Data de início é obrigatória para publicar.")

    if itinerario.tipo == 'multi_day':
        if not itinerario.data_fim:
            erros.append("Data de término é obrigatória para publicar um itinerário de múltiplos dias.")
        elif itinerario.data_inicio and itinerario.data_fim < itinerario.data_inicio:
            erros.append("Data de término não pode ser anterior à data de início.")

    pontos = list(itinerario.pontos.all())
    if not pontos:
        erros.append("O itinerário precisa de pelo menos um ponto.")

    for ponto in pontos:
        prefixo = f"Ponto #{ponto.ordem}"

        for campo in CAMPOS_OBRIGATORIOS_PONTO:
            if not getattr(ponto, campo):
                erros.append(f"{prefixo}: campo '{campo}' é obrigatório para publicar.")

        if ponto.entrada_gratuita and ponto.preco_medio is not None:
            erros.append(f"{prefixo}: local gratuito não deve ter avaliação de preço.")
        if not ponto.entrada_gratuita and ponto.preco_medio is None:
            erros.append(f"{prefixo}: informe a avaliação de preço, ou marque como entrada gratuita.")

        # Vídeo em 'processando' conta como mídia válida — a compressão
        # roda em background (até 15min, ver tasks.py) e não é razoável
        # obrigar o autor a esperar isso terminar só pra poder publicar.
        # Só 'erro' (compressão falhou) não conta.
        tem_foto = ponto.fotos.exists()
        tem_video_valido = ponto.videos.exclude(status='erro').exists()
        if not tem_foto and not tem_video_valido:
            erros.append(f"{prefixo}: adicione pelo menos uma foto ou vídeo.")

    if erros:
        raise DjangoValidationError(erros)


def publicar_itinerario(itinerario):
    validar_itinerario_para_publicacao(itinerario)
    itinerario.status = 'publicado'
    itinerario.publicado_em = timezone.now()
    itinerario.save(update_fields=['status', 'publicado_em'])
    return itinerario


def sincronizar_pontos_itinerario(itinerario, pontos_data):
    """Aplica `pontos_data` (a lista vinda do PontoItinerarioSerializer, já
    validada) aos PontoItinerario de `itinerario`, casando cada item pelo
    'id' quando o payload manda um — SEM apagar e recriar os registros.

    Isso importa porque FotoPontoItinerario e VideoPontoItinerario apontam
    pro PontoItinerario via CASCADE: apagar e recriar destruiria mídia já
    enviada toda vez que o formulário reenvia os pontos (ex: usuário corrige
    um campo depois de uma tentativa de publicação que falhou e tenta de
    novo). Ponto casado por id só tem os campos atualizados; sem id (ponto
    novo, adicionado no formulário depois da criação original) vira um
    INSERT normal.

    Um 'id' que não pertence a este itinerário (payload adulterado, ou um id
    de outro itinerário) simplesmente não bate com nada em `existentes` — cai
    no caminho de criar um ponto novo, sem id. Não há como essa função usar
    um id pra sequestrar ou sobrescrever o ponto de outro itinerário."""
    existentes = {p.id: p for p in itinerario.pontos.all()}
    ids_recebidos = set()

    # Ordens temporárias (garantidamente únicas) antes de aplicar os valores
    # finais: sem isso, inverter a ordem de dois pontos já existentes (ex:
    # trocar #1 com #2) pode tentar gravar um 'ordem' duplicado no meio do
    # caminho e estourar a constraint única (itinerario, ordem), já que os
    # saves acontecem um de cada vez.
    #
    # Precisa ser um offset POSITIVO grande, não negativo: 'ordem' é
    # PositiveIntegerField, e o Django gera automaticamente uma check
    # constraint no banco (ordem >= 0) pra esse tipo de campo — um valor
    # negativo aqui nunca seria aceito pelo Postgres, não importa o que o
    # MinValueValidator(1) do model deixe passar (esse só valida em
    # full_clean()/serializer, não é o que o banco de fato impõe). O offset
    # abaixo só precisa ser maior que qualquer 'ordem' real (a quantidade de
    # pontos de um itinerário é sempre pequena) pra garantir que não colide
    # com nenhum valor final nem entre si.
    offset_temporario = 1_000_000
    for i, ponto in enumerate(existentes.values(), start=1):
        ponto.ordem = offset_temporario + i
        ponto.save(update_fields=['ordem'])

    for dado in pontos_data:
        ponto_id = dado.pop('id', None)
        ponto = existentes.get(ponto_id) if ponto_id is not None else None

        if ponto is not None:
            ids_recebidos.add(ponto.id)
            for campo, valor in dado.items():
                setattr(ponto, campo, valor)
            ponto.save()
        else:
            novo = PontoItinerario.objects.create(itinerario=itinerario, **dado)
            ids_recebidos.add(novo.id)

    # Pontos que existiam antes mas não vieram no payload foram removidos no
    # formulário — aqui sim apagamos, e a mídia associada vai junto (CASCADE),
    # porque o ponto de fato deixou de existir, não é um retry/atualização.
    for ponto_id, ponto in existentes.items():
        if ponto_id not in ids_recebidos:
            ponto.delete()


def calcular_distancias_itinerario(itinerario):
    pontos = list(itinerario.pontos.order_by('ordem'))

    for i in range(len(pontos) - 1):
        atual = pontos[i]
        proximo = pontos[i + 1]

        distancia = calcular_distancia(
            atual.local.latitude, atual.local.longitude,
            proximo.local.latitude, proximo.local.longitude
        )

        atual.distancia_ate_proximo = distancia
        atual.save()