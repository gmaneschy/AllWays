import googlemaps
from django.conf import settings
import requests

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


def buscar_detalhes(place_id):
    """Place Details: usuário já escolheu uma sugestão, queremos os dados completos."""
    client = get_client()
    resultado = client.place(
        place_id=place_id,
        language='pt-BR',
        fields=['place_id', 'name', 'formatted_address', 'geometry']
    )
    info = resultado['result']
    return {
        'place_id': info['place_id'],
        'nome': info['name'],
        'endereco': info.get('formatted_address', ''),
        'latitude': info['geometry']['location']['lat'],
        'longitude': info['geometry']['location']['lng'],
    }


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