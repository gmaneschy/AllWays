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


Sobre o cálculo de distância:
O servidor gratuito (router.project-osrm.org) é mantido pela comunidade, sem garantia de disponibilidade (SLA) — ótimo para desenvolvimento e MVP, mas se o AllWays crescer e tiver volume real de usuários, vale migrar para hospedar sua própria instância OSRM (é open source, você pode rodar num servidor próprio) ou adotar um provedor pago como Geoapify/TravelTime, que oferecem mais estabilidade.


Princípio: lógica em serializers.py (validate, create customizado) 
só roda via API (/api/...). O Admin (/admin/...) passa direto pelo 
ModelForm do Django, ignorando serializers completamente.

Regras que PRECISAM valer em qualquer caminho de entrada (Admin incluso) 
→ colocar no model (clean(), validators=, constraints=).

Regras/processos que só fazem sentido no fluxo real do produto 
(o usuário final nunca usa o Admin) → podem ficar só no serializer/view,
sem necessidade de duplicar no model.

Exemplos já tratados:
- seguranca 1-5 → validators no MODEL (precisa valer também no Admin)
- entrada_gratuita + preco_medio → clean() no MODEL (idem)
- distancia_ate_proximo calculada → só no SERIALIZER (Admin não precisa)