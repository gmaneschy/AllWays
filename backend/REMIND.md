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

Regra: toda query que agrega/exibe dados de PontoItinerario para terceiros
(página de Place, feed, médias) DEVE filtrar itinerario__status='publicado'.
Rascunhos só são visíveis para o próprio autor, em endpoints futuros tipo
"meus rascunhos".

## Navegação React (pendências de protótipo)
- Link "Local de teste" na Navbar está hardcoded para /place/3 — substituir
  quando a busca (pessoas/locais/hashtags) estiver implementada.
- Página de busca ainda não existe: futuramente, campo de pesquisa estilo
  Instagram, cobrindo locais (Place), pessoas (User) e hashtags (Hashtag).
  Adiada propositalmente para não gastar cota de autocomplete/fotos do
  Google Places durante a fase de prototipagem.

## Ordem de construção (atualizada)
1. places        — esqueleto + integração Google completa
2. gamification  — 4 classes, admin funcionando
3. users         — model customizado, badge_destaque
4. itineraries   — completo: model, serializers aninhados, distância via OSRM, fotos
5. social        — Follow/Message/Comment testados (Comment depende de Itinerario real)
6. feed          — PRÓXIMO PASSO: versão simples cronológica (sem algoritmo ainda)

## Pendências técnicas conhecidas
- autor em ItinerarioSerializer está temporariamente aceito via body
  (não read_only) por falta de JWT. Reverter quando simplejwt for configurado:
  voltar autor para read_only_fields e usar serializer.save(autor=request.user)
  no perform_create.
- Página do Place (PaginaPlace.jsx) está sem navegação dinâmica ainda —
  precisa de busca/links reais assim que existir tela de busca ou feed.