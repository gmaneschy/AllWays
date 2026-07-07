import googlemaps
from django.conf import settings
import requests

try:
    import pycountry_convert as pc
except ImportError:
    pc = None

_client = None


def get_client():
    """Lazy init do client — evita erro se a chave não estiver configurada
    em ambientes onde places não está sendo usado (ex: rodando só testes de outro app)."""
    global _client
    if _client is None:
        _client = googlemaps.Client(key=settings.GOOGLE_MAPS_API_KEY)
    return _client


def buscar_sugestoes(texto_busca):
    """Autocomplete: usuário ainda está digitando, queremos só sugestões leves."""
    client = get_client()
    resultado = client.places_autocomplete(
        input_text=texto_busca,
        language='pt-BR'
    )
    return [
        {
            'place_id': item['place_id'],
            'descricao': item['description'],
        }
        for item in resultado
    ]


# ─── Gamificação: categorização e localização estruturada ─────────────────

TYPES_CULTURAIS = {
    'museum', 'art_gallery', 'library', 'movie_theater', 'tourist_attraction',
}
TYPES_RELIGIOSOS = {
    'church', 'mosque', 'synagogue', 'hindu_temple', 'place_of_worship',
}
TYPES_GASTRONOMICOS = {
    'restaurant', 'cafe', 'bar', 'bakery', 'meal_takeaway', 'meal_delivery', 'winery',
}

CODIGO_PARA_NOME_CONTINENTE = {
    'AF': 'África',
    'AS': 'Ásia',
    'EU': 'Europa',
    'NA': 'América do Norte',
    'SA': 'América do Sul',
    'OC': 'Oceania',
    'AN': 'Antártida',
}


def mapear_categoria_gamificacao(types):
    """Classifica o Place em cultural/religioso/gastronomico/outro
    a partir dos 'types' retornados pela Google Places API.
    Prioridade: religioso > cultural > gastronomico (um lugar de culto
    tombado como patrimônio histórico, por ex., deve contar como religioso)."""
    tipos = set(types or [])
    if tipos & TYPES_RELIGIOSOS:
        return 'religioso'
    if tipos & TYPES_CULTURAIS:
        return 'cultural'
    if tipos & TYPES_GASTRONOMICOS:
        return 'gastronomico'
    return 'outro'


def extrair_localizacao(address_components):
    """Extrai cidade/região/país estruturados a partir do
    address_components retornado pela Google Places API."""
    dados = {
        'cidade': '', 'regiao': '', 'regiao_codigo': '',
        'pais': '', 'pais_codigo': '',
    }
    for comp in address_components or []:
        tipos = comp.get('types', [])
        if 'locality' in tipos and not dados['cidade']:
            dados['cidade'] = comp['long_name']
        elif 'administrative_area_level_1' in tipos:
            dados['regiao'] = comp['long_name']
            dados['regiao_codigo'] = comp.get('short_name', '')
        elif 'country' in tipos:
            dados['pais'] = comp['long_name']
            dados['pais_codigo'] = comp.get('short_name', '')
    return dados


def obter_continente(pais_codigo):
    """Mapeia código ISO-2 do país para nome do continente via pycountry_convert.
    Retorna string vazia se não for possível determinar (lib ausente, código inválido etc.)."""
    if not pais_codigo or pc is None:
        return ''
    try:
        codigo_continente = pc.country_alpha2_to_continent_code(pais_codigo)
        return CODIGO_PARA_NOME_CONTINENTE.get(codigo_continente, '')
    except KeyError:
        return ''


def buscar_detalhes(place_id):
    client = get_client()
    resultado = client.place(
        place_id=place_id,
        language='pt-BR',
        fields=[
            'place_id', 'name', 'formatted_address', 'geometry', 'photo',
            'address_component', 'type',
        ]
    )
    info = resultado['result']

    foto_referencia = None
    if 'photos' in info and len(info['photos']) > 0:
        foto_referencia = info['photos'][0]['photo_reference']

    localizacao = extrair_localizacao(info.get('address_components'))
    continente = obter_continente(localizacao['pais_codigo'])
    categoria = mapear_categoria_gamificacao(info.get('types'))

    return {
        'place_id': info['place_id'],
        'nome': info['name'],
        'endereco': info.get('formatted_address', ''),
        'latitude': info['geometry']['location']['lat'],
        'longitude': info['geometry']['location']['lng'],
        'foto_referencia_google': foto_referencia,
        'cidade': localizacao['cidade'],
        'regiao': localizacao['regiao'],
        'regiao_codigo': localizacao['regiao_codigo'],
        'pais': localizacao['pais'],
        'pais_codigo': localizacao['pais_codigo'],
        'continente': continente,
        'categoria_gamificacao': categoria,
    }


def montar_url_foto_google(foto_referencia, max_width=800):
    """Monta a URL da Photos API do Google a partir da referência salva.
    O Google não fornece um link direto e permanente — a URL precisa
    ser remontada dinamicamente toda vez que a foto for exibida."""
    if not foto_referencia:
        return None

    return (
        f"https://maps.googleapis.com/maps/api/place/photo"
        f"?maxwidth={max_width}&photo_reference={foto_referencia}&key={settings.GOOGLE_MAPS_API_KEY}"
    )


def calcular_distancia(origem_lat, origem_lng, destino_lat, destino_lng):
    """Sempre calcula a distância a pé (modo 'foot'), como referência objetiva.
    O meio_deslocamento real do usuário é só informativo, não afeta esse cálculo."""
    url = f"https://router.project-osrm.org/route/v1/foot/{origem_lng},{origem_lat};{destino_lng},{destino_lat}"

    try:
        resposta = requests.get(url, params={'overview': 'false'}, timeout=5)
        dados = resposta.json()

        if dados.get('code') != 'Ok':
            print(f"OSRM retornou erro: {dados}")
            return None

        return dados['routes'][0]['distance']
    except requests.RequestException as e:
        print(f"Erro de conexão com OSRM: {e}")
        return None