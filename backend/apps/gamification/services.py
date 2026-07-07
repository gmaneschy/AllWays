from collections import defaultdict

from .models import BadgeUsuario, UsuarioBadge

try:
    import pycountry
    import pycountry_convert as pc
except ImportError:
    pycountry = None
    pc = None


CODIGO_PARA_NOME_CONTINENTE = {
    'AF': 'África', 'AS': 'Ásia', 'EU': 'Europa',
    'NA': 'América do Norte', 'SA': 'América do Sul',
    'OC': 'Oceania', 'AN': 'Antártida',
}
NOME_PARA_CODIGO_CONTINENTE = {v: k for k, v in CODIGO_PARA_NOME_CONTINENTE.items()}

CIRCULO_POLAR_ARTICO = 66.5
CIRCULO_POLAR_ANTARTICO = -66.5

TIPOS_DISTANCIA_POR_CRITERIO = {
    BadgeUsuario.CRITERIO_KM_A_PE: 'Peregrino',
    BadgeUsuario.CRITERIO_KM_CARRO_MOTO_TAXI: 'I Drive',
    BadgeUsuario.CRITERIO_KM_TRANSPORTE_PUBLICO: 'Regular Life',
    BadgeUsuario.CRITERIO_KM_BICICLETA: 'Duas Rodas e Um Destino',
}

TIPOS_CATEGORIA_POR_CRITERIO = {
    BadgeUsuario.CRITERIO_LUGARES_CULTURAIS: 'Viajante Cultural',
    BadgeUsuario.CRITERIO_LUGARES_RELIGIOSOS: 'Viajante Religioso',
    BadgeUsuario.CRITERIO_LUGARES_GASTRONOMICOS: 'Viajante Gastronômico',
}

CATEGORIA_PLACE_POR_CRITERIO = {
    'cultural': BadgeUsuario.CRITERIO_LUGARES_CULTURAIS,
    'religioso': BadgeUsuario.CRITERIO_LUGARES_RELIGIOSOS,
    'gastronomico': BadgeUsuario.CRITERIO_LUGARES_GASTRONOMICOS,
}


# ─── Helpers de dados base ─────────────────────────────────────────────────

def _pontos_publicados_usuario(usuario):
    """Todos os PontoItinerario de itinerários publicados do usuário, com o Place já carregado."""
    from apps.itineraries.models import PontoItinerario
    return PontoItinerario.objects.filter(
        itinerario__autor=usuario,
        itinerario__status='publicado'
    ).select_related('local')


def _lugares_distintos_usuario(usuario):
    """Queryset de Place distintos visitados pelo usuário — visitas repetidas
    ao mesmo lugar não contam mais de uma vez, conforme a regra definida."""
    from apps.places.models import Place
    ids = _pontos_publicados_usuario(usuario).values_list('local_id', flat=True).distinct()
    return Place.objects.filter(id__in=ids)


def _niveis_atingidos(tipo_nome, criterio_campo, valor_atual):
    """Todos os níveis de uma família cujo criterio_valor já foi atingido pelo valor_atual."""
    return BadgeUsuario.objects.filter(
        tipo__nome=tipo_nome,
        criterio_campo=criterio_campo,
        criterio_valor__lte=valor_atual,
    )


def _conceder_se_necessario(usuario, badge, contexto=''):
    """Cria o UsuarioBadge se ainda não existir para essa combinação (idempotente —
    pode ser chamado repetidamente sem duplicar conquistas)."""
    _, criado = UsuarioBadge.objects.get_or_create(
        usuario=usuario, badge=badge, contexto=contexto
    )
    return criado


# ─── Referência geográfica (pycountry / pycountry_convert) ────────────────

def _total_regioes_no_pais(pais_codigo):
    """Total de subdivisões ISO 3166-2 (estado/província/etc.) de um país.
    Retorna None se a lib não estiver disponível ou o país não tiver dado confiável —
    nesse caso o badge 'Viajante Nacional' simplesmente não é avaliado para esse país."""
    if not pycountry or not pais_codigo:
        return None
    try:
        subdivisoes = list(pycountry.subdivisions.get(country_code=pais_codigo))
        return len(subdivisoes) or None
    except Exception:
        return None


def _total_paises_no_continente(codigo_continente):
    if not pycountry or not pc or not codigo_continente:
        return None
    total = 0
    for pais in pycountry.countries:
        try:
            cc = pc.country_alpha2_to_continent_code(pais.alpha_2)
        except KeyError:
            continue
        if cc == codigo_continente:
            total += 1
    return total or None


def _total_paises_no_mundo():
    if not pycountry:
        return None
    return len(list(pycountry.countries)) or None


# ─── Avaliadores por família de badge ──────────────────────────────────────

def avaliar_viajante_local(usuario):
    """Bronze/Prata/Ouro por CIDADE — lugares distintos visitados em cada cidade."""
    lugares = _lugares_distintos_usuario(usuario).exclude(cidade='')
    contagem_por_cidade = defaultdict(int)
    for lugar in lugares:
        contagem_por_cidade[lugar.cidade] += 1

    concedidos = []
    for cidade, quantidade in contagem_por_cidade.items():
        for nivel in _niveis_atingidos('Viajante Local', BadgeUsuario.CRITERIO_LUGARES_DISTINTOS_CIDADE, quantidade):
            if _conceder_se_necessario(usuario, nivel, contexto=cidade):
                concedidos.append(nivel)
    return concedidos


def avaliar_viajante_regional(usuario):
    """Bronze/Prata/Ouro por REGIÃO — cidades distintas visitadas dentro da mesma região."""
    lugares = _lugares_distintos_usuario(usuario).exclude(regiao='').exclude(cidade='')
    cidades_por_regiao = defaultdict(set)
    for lugar in lugares:
        cidades_por_regiao[lugar.regiao].add(lugar.cidade)

    concedidos = []
    for regiao, cidades in cidades_por_regiao.items():
        for nivel in _niveis_atingidos('Viajante Regional', BadgeUsuario.CRITERIO_CIDADES_DISTINTAS_REGIAO, len(cidades)):
            if _conceder_se_necessario(usuario, nivel, contexto=regiao):
                concedidos.append(nivel)
    return concedidos


def avaliar_viajante_nacional(usuario):
    """Bronze/Prata/Ouro por PAÍS — % de regiões distintas visitadas dentro do país,
    sobre o total real de regiões daquele país (pycountry). Países sem dado
    confiável de subdivisões são pulados silenciosamente."""
    lugares = _lugares_distintos_usuario(usuario).exclude(pais_codigo='').exclude(regiao='')
    regioes_por_pais = defaultdict(set)
    nome_por_codigo = {}
    for lugar in lugares:
        regioes_por_pais[lugar.pais_codigo].add(lugar.regiao)
        nome_por_codigo[lugar.pais_codigo] = lugar.pais

    concedidos = []
    for pais_codigo, regioes in regioes_por_pais.items():
        total = _total_regioes_no_pais(pais_codigo)
        if not total:
            continue
        percentual = (len(regioes) / total) * 100
        for nivel in _niveis_atingidos('Viajante Nacional', BadgeUsuario.CRITERIO_PERCENTUAL_REGIOES_PAIS, percentual):
            contexto = nome_por_codigo.get(pais_codigo, pais_codigo)
            if _conceder_se_necessario(usuario, nivel, contexto=contexto):
                concedidos.append(nivel)
    return concedidos


def avaliar_viajante_continental(usuario):
    """Bronze/Prata/Ouro por CONTINENTE — % de países distintos visitados dentro do continente."""
    lugares = _lugares_distintos_usuario(usuario).exclude(pais_codigo='').exclude(continente='')
    paises_por_continente = defaultdict(set)
    for lugar in lugares:
        paises_por_continente[lugar.continente].add(lugar.pais_codigo)

    concedidos = []
    for continente, paises in paises_por_continente.items():
        codigo_continente = NOME_PARA_CODIGO_CONTINENTE.get(continente)
        total = _total_paises_no_continente(codigo_continente)
        if not total:
            continue
        percentual = (len(paises) / total) * 100
        for nivel in _niveis_atingidos('Viajante Continental', BadgeUsuario.CRITERIO_PERCENTUAL_PAISES_CONTINENTE, percentual):
            if _conceder_se_necessario(usuario, nivel, contexto=continente):
                concedidos.append(nivel)
    return concedidos


def avaliar_viajante_intercontinental(usuario):
    """Bronze/Prata/Ouro/Diamante — nº de continentes distintos visitados (badge global, sem contexto)."""
    lugares = _lugares_distintos_usuario(usuario).exclude(continente='')
    continentes = set(lugares.values_list('continente', flat=True))

    concedidos = []
    for nivel in _niveis_atingidos('Viajante Intercontinental', BadgeUsuario.CRITERIO_CONTINENTES_VISITADOS, len(continentes)):
        if _conceder_se_necessario(usuario, nivel):
            concedidos.append(nivel)
    return concedidos


def avaliar_viajante_global(usuario):
    """Bronze/Prata/Ouro/Diamante — % de países distintos visitados no mundo inteiro."""
    total_mundo = _total_paises_no_mundo()
    if not total_mundo:
        return []

    lugares = _lugares_distintos_usuario(usuario).exclude(pais_codigo='')
    paises = set(lugares.values_list('pais_codigo', flat=True))
    percentual = (len(paises) / total_mundo) * 100

    concedidos = []
    for nivel in _niveis_atingidos('Viajante Global', BadgeUsuario.CRITERIO_PERCENTUAL_PAISES_MUNDO, percentual):
        if _conceder_se_necessario(usuario, nivel):
            concedidos.append(nivel)
    return concedidos


def avaliar_badges_distancia(usuario):
    """Peregrino / I Drive / Regular Life / Duas Rodas e Um Destino —
    soma de distância (km) por meio de deslocamento, nos itinerários publicados.
    Carro e táxi/app são agregados sob o mesmo critério (I Drive)."""
    pontos = _pontos_publicados_usuario(usuario).exclude(
        distancia_ate_proximo__isnull=True
    ).exclude(meio_deslocamento='')

    km_por_criterio = defaultdict(float)
    for ponto in pontos:
        modo = ponto.meio_deslocamento
        if modo in ('carro', 'taxi_app'):
            criterio = BadgeUsuario.CRITERIO_KM_CARRO_MOTO_TAXI
        elif modo == 'a_pe':
            criterio = BadgeUsuario.CRITERIO_KM_A_PE
        elif modo == 'transporte_publico':
            criterio = BadgeUsuario.CRITERIO_KM_TRANSPORTE_PUBLICO
        elif modo == 'bicicleta':
            criterio = BadgeUsuario.CRITERIO_KM_BICICLETA
        else:
            continue
        km_por_criterio[criterio] += ponto.distancia_ate_proximo / 1000  # metros → km

    concedidos = []
    for criterio, km_total in km_por_criterio.items():
        tipo_nome = TIPOS_DISTANCIA_POR_CRITERIO[criterio]
        for nivel in _niveis_atingidos(tipo_nome, criterio, km_total):
            if _conceder_se_necessario(usuario, nivel):
                concedidos.append(nivel)
    return concedidos


def avaliar_numa_fria(usuario):
    """Ouro (1 polo) / Diamante (2 polos) — lugares acima do Círculo Polar Ártico
    e/ou abaixo do Círculo Polar Antártico, com base na latitude do Place."""
    lugares = _lugares_distintos_usuario(usuario).exclude(latitude__isnull=True)
    polos = set()
    for lugar in lugares:
        if lugar.latitude >= CIRCULO_POLAR_ARTICO:
            polos.add('artico')
        elif lugar.latitude <= CIRCULO_POLAR_ANTARTICO:
            polos.add('antartida')

    concedidos = []
    for nivel in _niveis_atingidos('Numa Fria', BadgeUsuario.CRITERIO_POLOS_VISITADOS, len(polos)):
        if _conceder_se_necessario(usuario, nivel):
            concedidos.append(nivel)
    return concedidos


def avaliar_badges_categoria(usuario):
    """Viajante Cultural / Religioso / Gastronômico — nº de lugares distintos
    visitados por categoria, derivada do 'categoria_gamificacao' do Place."""
    lugares = _lugares_distintos_usuario(usuario)
    contagem = defaultdict(int)
    for lugar in lugares:
        criterio = CATEGORIA_PLACE_POR_CRITERIO.get(lugar.categoria_gamificacao)
        if criterio:
            contagem[criterio] += 1

    concedidos = []
    for criterio, quantidade in contagem.items():
        tipo_nome = TIPOS_CATEGORIA_POR_CRITERIO[criterio]
        for nivel in _niveis_atingidos(tipo_nome, criterio, quantidade):
            if _conceder_se_necessario(usuario, nivel):
                concedidos.append(nivel)
    return concedidos


# ─── Ponto de entrada único ─────────────────────────────────────────────────

def avaliar_e_conceder_badges(usuario):
    """Roda todas as avaliações de badge de usuário e concede automaticamente
    os níveis que ainda faltam. Chamado sob demanda (signal de publicação de
    itinerário, novo follow etc.) e reforçado por uma task Celery periódica de garantia."""
    if usuario is None or not getattr(usuario, 'is_authenticated', False):
        return []

    concedidos = []
    concedidos += avaliar_viajante_local(usuario)
    concedidos += avaliar_viajante_regional(usuario)
    concedidos += avaliar_viajante_nacional(usuario)
    concedidos += avaliar_viajante_continental(usuario)
    concedidos += avaliar_viajante_intercontinental(usuario)
    concedidos += avaliar_viajante_global(usuario)
    concedidos += avaliar_badges_distancia(usuario)
    concedidos += avaliar_numa_fria(usuario)
    concedidos += avaliar_badges_categoria(usuario)
    return concedidos