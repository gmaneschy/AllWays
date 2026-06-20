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
1. places        — não depende de ninguém em nível de model
2. gamification  — precisa existir antes de users (User.badge_destaque é FK pra BadgeUsuario)
3. users         — depende de gamification; users.User é referenciado por quase todo o resto
4. itineraries   — depende de users, places, gamification (ItinerarioBadge)
5. social        — depende de users, places, itineraries (Comment.local, etc)
6. feed          — só lê de todos; não escreve; nunca recebe FK; construir por último

Regra: FK para User usa SET_NULL quando o registro é CONTEÚDO 
com valor independente do autor (comentário, itinerário, mensagem).

Usa CASCADE quando o registro é uma RELAÇÃO ou ESTADO que só 
faz sentido enquanto ambas as pontas existem (follow, badge conquistado, 
likes, salvos/baixados).

Teste rápido: "esse registro ainda tem utilidade pra OUTRAS pessoas 
se o autor desaparecer?" → SET_NULL. 
"Esse registro é só sobre a relação entre duas entidades?" → CASCADE.

Regra: gamification é observado apenas por UMA via controlada: 
User.badge_destaque (exibição do selo "verificado" junto ao nome).

Todo o restante do fluxo (concessão de badges, critérios, histórico) 
é gamification OBSERVANDO outros apps via signals — nunca o contrário.


Ordem de ESQUELETOS (classes existindo no código, completas ou não):
1. places.Place          (esqueleto mínimo)
2. itineraries.Itinerario (esqueleto mínimo) ← necessário por gamification.ItinerarioBadge
3. gamification (4 classes completas)
4. users.User (completo)

Ordem de MIGRATIONS:
makemigrations gamification users itineraries (numa única chamada, 
já que há referências cruzadas entre os três)


!!!!!!!!
def perform_create(self, serializer):
    # Por enquanto sem autenticação real, então aceitamos autor vindo no body.
    # Quando JWT estiver configurado, troque para: serializer.save(autor=self.request.user)
    serializer.save()
