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

Fluxo de dependências dos Apps
1. users         — não depende de ninguém
2. places        — não depende de ninguém em nível de model
3. itineraries   — depende de users e places
4. social        — depende de users, places e itineraries (FKs: Comment.local, etc)
5. gamification  — observa via signals; nunca recebe FK de ninguém
6. feed          — só lê de todos; não escreve; constrói por último

Regra: FK para User usa SET_NULL quando o registro é CONTEÚDO 
com valor independente do autor (comentário, itinerário, mensagem).

Usa CASCADE quando o registro é uma RELAÇÃO ou ESTADO que só 
faz sentido enquanto ambas as pontas existem (follow, badge conquistado, 
likes, salvos/baixados).

Teste rápido: "esse registro ainda tem utilidade pra OUTRAS pessoas 
se o autor desaparecer?" → SET_NULL. 
"Esse registro é só sobre a relação entre duas entidades?" → CASCADE.