import googlemaps
from django.conf import settings

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