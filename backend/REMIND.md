Sobre serializers.py
React Native faz fetch()
        ↓
        ↓ requisição HTTP chega no Django
        ↓
      URLs (urls.py) → direciona para a View certa
        ↓
      View (views.py) → orquestra o quê fazer
        ↓
      Serializer (serializers.py) → converte Model ↔ JSON
        ↓
      View devolve a Response
        ↓
React Native recebe o JSON
A view é a integração com o frontend (é ela que recebe e responde a requisição). 
O serializer é uma ferramenta que a view usa para não precisar converter manualmente cada campo do model em JSON e validar cada campo recebido na mão.