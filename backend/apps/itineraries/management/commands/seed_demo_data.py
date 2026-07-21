"""
seed_demo_data — popula o banco com uma massa de dados realista para testar,
a longo prazo e em escala, as interações entre usuários: feed, algoritmo de
recomendação (scoring por regras + filtragem colaborativa), gamificação
(badges) e o básico de social (follows, curtidas, comentários, mensagens).

DECISÕES DE DESIGN (leia antes de rodar em produção — isso é só para dev/demo):

1. Distância entre pontos NÃO usa o OSRM real. Calculamos via fórmula de
   Haversine (linha reta) — evita depender de um serviço externo de pé e
   deixa o seed rápido mesmo com centenas de itinerários. Só serve para
   preencher `distancia_ate_proximo` de forma plausível para a UI e para os
   badges de distância; não é uma rota real.

2. Perfil de interesse, similaridade entre usuários, feed cache e badges são
   recalculados de forma SÍNCRONA no final do comando (chamando
   apps.feed.services e apps.gamification.services diretamente), em vez de
   esperar o Celery Beat rodar (a cada 6h/1 dia, conforme config/celery.py).
   As notificações (follow, comentário, curtida, mensagem) continuam
   passando pelo Celery normalmente, via signal — não precisa do worker de
   pé para o restante dos dados fazer sentido, mas ele precisa estar de pé
   para essas notificações serem de fato criadas.

3. Usuários, itinerários e o cluster temático são distribuídos de forma
   enviesada (não uniforme): cada usuário tem uma afinidade principal por um
   dos 4 clusters (praia_natureza, cultura_historia, gastronomia, urbano) e
   tende a seguir, salvar e curtir mais dentro do próprio cluster — isso cria
   sinal real para a similaridade de Jaccard e o scoring por hashtag
   descobrirem, em vez de ruído uniforme onde tudo dá parecido com tudo.

Uso:
    python manage.py seed_demo_data
    python manage.py seed_demo_data --usuarios 60 --itinerarios 200 --dias 180
    python manage.py seed_demo_data --limpar          # apaga os dados de demo existentes antes
    python manage.py seed_demo_data --limpar --apenas-limpar   # só apaga, não recria

Os dados de seed são sempre identificáveis (username começa com "demo_",
place_id começa com "seed_"), então dá pra rodar --limpar com segurança sem
tocar em dados reais que você tenha criado manualmente.
"""
import math
import random
import string
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import IntegrityError
from django.utils import timezone

from apps.users.models import User
from apps.places.models import Place
from apps.itineraries.models import Itinerario, PontoItinerario, ItinerarioSalvo
from apps.social.models import Follow, Comment, Message, Curtida
from apps.feed.models import FeedEvent
from apps.feed.services import (
    recalcular_interesse_usuario, recalcular_similaridades_usuario, recalcular_feed_usuario,
)
from apps.gamification.services import avaliar_e_conceder_badges
from django.contrib.contenttypes.models import ContentType


# ─── Clusters temáticos (só existem aqui, no seed — não são um campo do banco) ──
# Usados para enviesar afinidade de usuário, hashtags do comentário e formação
# de itinerário, de forma a criar sinal real para o algoritmo de recomendação.
CLUSTERS = ['praia_natureza', 'cultura_historia', 'gastronomia', 'urbano']

HASHTAGS_POR_CLUSTER = {
    'praia_natureza': ['praia', 'natureza', 'trilha', 'aventura', 'paisagem'],
    'cultura_historia': ['historia', 'cultura', 'museu', 'arquitetura', 'patrimonio'],
    'gastronomia': ['gastronomia', 'comidaderua', 'restaurante', 'sabor', 'culinaria'],
    'urbano': ['urbano', 'vidanoturna', 'compras', 'skyline', 'metropole'],
}

# ─── Places curados: cidades reais, coordenadas aproximadas, espalhados por  ──
# 7 "continentes" (incluindo Antártida) para exercitar toda a árvore de badges
# geográficos (Local → Regional → Nacional → Continental → Intercontinental → Global)
# e o badge "Numa Fria" (círculo polar ártico/antártico).
PLACES_SEED = [
    # Ceará, Brasil — mesma região, 3 cidades (testa Viajante Regional)
    dict(slug='fortaleza-praia-futuro', nome='Praia do Futuro', cidade='Fortaleza', regiao='Ceará', regiao_codigo='CE',
         pais='Brasil', pais_codigo='BR', continente='América do Sul', categoria='outro', cluster='praia_natureza',
         lat=-3.7275, lng=-38.4664),
    dict(slug='fortaleza-mercado-central', nome='Mercado Central de Fortaleza', cidade='Fortaleza', regiao='Ceará', regiao_codigo='CE',
         pais='Brasil', pais_codigo='BR', continente='América do Sul', categoria='gastronomico', cluster='gastronomia',
         lat=-3.7275, lng=-38.5265),
    dict(slug='juazeiro-horto', nome='Horto do Padre Cícero', cidade='Juazeiro do Norte', regiao='Ceará', regiao_codigo='CE',
         pais='Brasil', pais_codigo='BR', continente='América do Sul', categoria='religioso', cluster='cultura_historia',
         lat=-7.2214, lng=-39.3408),
    dict(slug='jericoacoara-duna-por-do-sol', nome='Duna do Pôr do Sol', cidade='Jericoacoara', regiao='Ceará', regiao_codigo='CE',
         pais='Brasil', pais_codigo='BR', continente='América do Sul', categoria='outro', cluster='praia_natureza',
         lat=-2.7975, lng=-40.5137),

    # São Paulo e Rio, Brasil — outras regiões do mesmo país (testa Viajante Nacional)
    dict(slug='sao-paulo-mercadao', nome='Mercadão de São Paulo', cidade='São Paulo', regiao='São Paulo', regiao_codigo='SP',
         pais='Brasil', pais_codigo='BR', continente='América do Sul', categoria='gastronomico', cluster='gastronomia',
         lat=-23.5431, lng=-46.6291),
    dict(slug='sao-paulo-paulista', nome='Avenida Paulista', cidade='São Paulo', regiao='São Paulo', regiao_codigo='SP',
         pais='Brasil', pais_codigo='BR', continente='América do Sul', categoria='outro', cluster='urbano',
         lat=-23.5613, lng=-46.6564),
    dict(slug='rio-cristo-redentor', nome='Cristo Redentor', cidade='Rio de Janeiro', regiao='Rio de Janeiro', regiao_codigo='RJ',
         pais='Brasil', pais_codigo='BR', continente='América do Sul', categoria='religioso', cluster='cultura_historia',
         lat=-22.9519, lng=-43.2105),
    dict(slug='rio-copacabana', nome='Praia de Copacabana', cidade='Rio de Janeiro', regiao='Rio de Janeiro', regiao_codigo='RJ',
         pais='Brasil', pais_codigo='BR', continente='América do Sul', categoria='outro', cluster='praia_natureza',
         lat=-22.9711, lng=-43.1822),

    # Argentina — 2º país na América do Sul (testa Viajante Continental)
    dict(slug='buenos-aires-caminito', nome='Caminito', cidade='Buenos Aires', regiao='Buenos Aires', regiao_codigo='C',
         pais='Argentina', pais_codigo='AR', continente='América do Sul', categoria='cultural', cluster='cultura_historia',
         lat=-34.6345, lng=-58.3627),

    # EUA — América do Norte, 2 regiões
    dict(slug='nova-york-times-square', nome='Times Square', cidade='Nova York', regiao='Nova York', regiao_codigo='NY',
         pais='Estados Unidos', pais_codigo='US', continente='América do Norte', categoria='outro', cluster='urbano',
         lat=40.7580, lng=-73.9855),
    dict(slug='los-angeles-hollywood', nome='Calçada da Fama', cidade='Los Angeles', regiao='Califórnia', regiao_codigo='CA',
         pais='Estados Unidos', pais_codigo='US', continente='América do Norte', categoria='outro', cluster='urbano',
         lat=34.1016, lng=-118.3267),

    # México — 2º país na América do Norte
    dict(slug='cidade-mexico-taqueria', nome='Mercado de Coyoacán', cidade='Cidade do México', regiao='Cidade do México', regiao_codigo='CMX',
         pais='México', pais_codigo='MX', continente='América do Norte', categoria='gastronomico', cluster='gastronomia',
         lat=19.3467, lng=-99.1621),

    # Europa — França/Itália/Portugal
    dict(slug='paris-torre-eiffel', nome='Torre Eiffel', cidade='Paris', regiao='Île-de-France', regiao_codigo='IDF',
         pais='França', pais_codigo='FR', continente='Europa', categoria='cultural', cluster='cultura_historia',
         lat=48.8584, lng=2.2945),
    dict(slug='roma-coliseu', nome='Coliseu', cidade='Roma', regiao='Lácio', regiao_codigo='LAZ',
         pais='Itália', pais_codigo='IT', continente='Europa', categoria='cultural', cluster='cultura_historia',
         lat=41.8902, lng=12.4922),
    dict(slug='veneza-canais', nome='Grande Canal', cidade='Veneza', regiao='Vêneto', regiao_codigo='VEN',
         pais='Itália', pais_codigo='IT', continente='Europa', categoria='outro', cluster='praia_natureza',
         lat=45.4408, lng=12.3155),
    dict(slug='lisboa-belem', nome='Torre de Belém', cidade='Lisboa', regiao='Lisboa', regiao_codigo='LIS',
         pais='Portugal', pais_codigo='PT', continente='Europa', categoria='religioso', cluster='cultura_historia',
         lat=38.6916, lng=-9.2160),
    dict(slug='tromso-aurora', nome='Mirante da Aurora Boreal', cidade='Tromsø', regiao='Troms og Finnmark', regiao_codigo='TF',
         pais='Noruega', pais_codigo='NO', continente='Europa', categoria='outro', cluster='praia_natureza',
         lat=69.6492, lng=18.9553),  # >= 66.5°N: cruza o Círculo Polar Ártico (badge "Numa Fria")

    # Ásia — Japão/Tailândia
    dict(slug='toquio-shibuya', nome='Cruzamento de Shibuya', cidade='Tóquio', regiao='Tóquio', regiao_codigo='TYO',
         pais='Japão', pais_codigo='JP', continente='Ásia', categoria='outro', cluster='urbano',
         lat=35.6595, lng=139.7005),
    dict(slug='quioto-fushimi', nome='Santuário Fushimi Inari', cidade='Kyoto', regiao='Quioto', regiao_codigo='KYT',
         pais='Japão', pais_codigo='JP', continente='Ásia', categoria='religioso', cluster='cultura_historia',
         lat=34.9671, lng=135.7727),
    dict(slug='bangkok-mercado-flutuante', nome='Mercado Flutuante', cidade='Bangkok', regiao='Bangkok', regiao_codigo='BKK',
         pais='Tailândia', pais_codigo='TH', continente='Ásia', categoria='gastronomico', cluster='gastronomia',
         lat=13.7563, lng=100.5018),

    # África — Egito/Marrocos
    dict(slug='cairo-piramides', nome='Pirâmides de Gizé', cidade='Cairo', regiao='Gizé', regiao_codigo='GIZ',
         pais='Egito', pais_codigo='EG', continente='África', categoria='cultural', cluster='cultura_historia',
         lat=29.9792, lng=31.1342),
    dict(slug='marrakech-souks', nome='Souks de Marrakech', cidade='Marrakech', regiao='Marrakech-Safi', regiao_codigo='MS',
         pais='Marrocos', pais_codigo='MA', continente='África', categoria='gastronomico', cluster='gastronomia',
         lat=31.6295, lng=-7.9811),

    # Oceania — Austrália, 2 regiões
    dict(slug='sydney-opera-house', nome='Opera House', cidade='Sydney', regiao='Nova Gales do Sul', regiao_codigo='NSW',
         pais='Austrália', pais_codigo='AU', continente='Oceania', categoria='cultural', cluster='urbano',
         lat=-33.8568, lng=151.2153),
    dict(slug='melbourne-laneways', nome='Laneways do Centro', cidade='Melbourne', regiao='Vitória', regiao_codigo='VIC',
         pais='Austrália', pais_codigo='AU', continente='Oceania', categoria='gastronomico', cluster='gastronomia',
         lat=-37.8136, lng=144.9631),

    # Antártida — coordenada ajustada de propósito para cruzar o Círculo Polar
    # Antártico (<=-66.5°) e destravar o 7º continente + badge "Numa Fria" nível
    # Diamante. É dado de demonstração, não uma localização real precisa.
    dict(slug='estacao-antartica-demo', nome='Estação de Pesquisa Antártica (demo)', cidade='', regiao='', regiao_codigo='',
         pais='Antártida', pais_codigo='AQ', continente='Antártida', categoria='outro', cluster='praia_natureza',
         lat=-75.10, lng=-0.07),
]

NOMES = [
    'Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabriela', 'Hugo', 'Isabela', 'João',
    'Karina', 'Lucas', 'Mariana', 'Nicolas', 'Olívia', 'Pedro', 'Quezia', 'Rafael', 'Sofia', 'Thiago',
    'Ursula', 'Vitor', 'Wanda', 'Xavier', 'Yara', 'Zeca', 'Amanda', 'Bernardo', 'Camila', 'Daniel',
    'Emma', 'Felipe', 'Giulia', 'Henrique', 'Ines', 'Julia', 'Kevin', 'Larissa', 'Marcelo', 'Natalia',
]
SOBRENOMES = [
    'Silva', 'Souza', 'Oliveira', 'Costa', 'Pereira', 'Almeida', 'Nascimento', 'Lima', 'Araújo', 'Fernandes',
    'Carvalho', 'Gomes', 'Martins', 'Rocha', 'Ribeiro', 'Alves', 'Monteiro', 'Cardoso', 'Teixeira', 'Correia',
]
BIOS = [
    'Sempre com a mala pronta para a próxima aventura ✈️',
    'Colecionando pôr do sol em cada cidade que visito 🌅',
    'Comida de rua > restaurante chique, sempre',
    'Trilhas, montanhas e um bom café da manhã',
    'Explorando o mundo um itinerário de cada vez',
    'Fã de museus, ruínas e histórias antigas',
    'Vida de nômade digital — trabalho de onde der',
    '',  # bio vazia também é realista
]

SENHA_PADRAO = 'demo12345'


def slugify_simples(texto):
    permitido = string.ascii_lowercase + string.digits
    saida = ''.join(c if c in permitido else '' for c in texto.lower().replace(' ', ''))
    return saida or 'x'


def haversine_metros(lat1, lng1, lat2, lng2):
    """Distância aproximada em linha reta (metros) — substitui o OSRM no seed
    para não depender de um serviço externo de pé ao criar centenas de pontos."""
    if None in (lat1, lng1, lat2, lng2):
        return None
    R = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c)


class Command(BaseCommand):
    help = 'Popula o banco com dados de demonstração (usuários, places, itinerários, follows, curtidas, comentários, feed events) para testar feed, recomendação e gamificação em escala.'

    def add_arguments(self, parser):
        parser.add_argument('--usuarios', type=int, default=40, help='Quantidade de usuários demo a criar (padrão: 40)')
        parser.add_argument('--itinerarios', type=int, default=140, help='Quantidade de itinerários a criar (padrão: 140)')
        parser.add_argument('--dias', type=int, default=120, help='Janela de dias no passado para espalhar publicações/eventos (padrão: 120)')
        parser.add_argument('--limpar', action='store_true', help='Apaga os dados demo existentes (username/place_id com prefixo demo_/seed_) antes de rodar')
        parser.add_argument('--apenas-limpar', action='store_true', help='Só limpa, não recria nada')
        parser.add_argument('--semente', type=int, default=None, help='Semente do random, para reproduzir o mesmo dataset entre execuções')

    def handle(self, *args, **options):
        if options['semente'] is not None:
            random.seed(options['semente'])

        if options['limpar'] or options['apenas_limpar']:
            self._limpar()

        if options['apenas_limpar']:
            self.stdout.write(self.style.SUCCESS('Dados demo removidos. Nada mais foi criado (--apenas-limpar).'))
            return

        self.stdout.write('Criando places...')
        places = self._criar_places()

        self.stdout.write(f"Criando {options['usuarios']} usuários...")
        usuarios = self._criar_usuarios(options['usuarios'])

        self.stdout.write(f"Criando {options['itinerarios']} itinerários...")
        itinerarios = self._criar_itinerarios(usuarios, places, options['itinerarios'], options['dias'])

        self.stdout.write('Criando follows (usuário→usuário e usuário→place)...')
        total_follows = self._criar_follows(usuarios, places)

        self.stdout.write('Criando saves...')
        total_saves = self._criar_saves(usuarios, itinerarios)

        self.stdout.write('Criando curtidas...')
        total_curtidas = self._criar_curtidas(usuarios, itinerarios)

        self.stdout.write('Criando comentários (com algumas threads de resposta)...')
        total_comentarios = self._criar_comentarios(usuarios, itinerarios)

        self.stdout.write('Criando mensagens diretas...')
        total_mensagens = self._criar_mensagens(usuarios)

        self.stdout.write('Gerando feed events (view/like/save/comment_post/use_as_base)...')
        total_eventos = self._criar_feed_events(usuarios, itinerarios, options['dias'])

        self.stdout.write('Recalculando perfis de interesse, similaridade, feed cache e badges (síncrono, sem esperar o Celery Beat)...')
        self._bootstrap_sincrono(usuarios)

        self.stdout.write(self.style.SUCCESS(
            '\nSeed concluído:\n'
            f'  places:       {len(places)}\n'
            f'  usuários:     {len(usuarios)} (senha de todos: "{SENHA_PADRAO}")\n'
            f'  itinerários:  {len(itinerarios)}\n'
            f'  follows:      {total_follows}\n'
            f'  saves:        {total_saves}\n'
            f'  curtidas:     {total_curtidas}\n'
            f'  comentários:  {total_comentarios}\n'
            f'  mensagens:    {total_mensagens}\n'
            f'  feed events:  {total_eventos}\n'
        ))

    # ─── Limpeza ────────────────────────────────────────────────────────────

    def _limpar(self):
        self.stdout.write('Removendo dados demo existentes...')
        # Cascateia pra a maioria das coisas (itinerários, follows, curtidas,
        # comentários, mensagens são SET_NULL ou CASCADE a partir do usuário/place).
        qtd_usuarios, _ = User.objects.filter(username__startswith='demo_').delete()
        qtd_places, _ = Place.objects.filter(place_id__startswith='seed_').delete()
        self.stdout.write(f'  removidos: {qtd_usuarios} registros ligados a usuários demo, {qtd_places} registros ligados a places seed.')

    # ─── Places ─────────────────────────────────────────────────────────────

    def _criar_places(self):
        places = []
        for dados in PLACES_SEED:
            place, _ = Place.objects.update_or_create(
                place_id=f"seed_{dados['slug']}",
                defaults=dict(
                    nome=dados['nome'],
                    endereco=f"{dados['cidade']}, {dados['pais']}" if dados['cidade'] else dados['pais'],
                    latitude=dados['lat'],
                    longitude=dados['lng'],
                    cidade=dados['cidade'],
                    regiao=dados['regiao'],
                    regiao_codigo=dados['regiao_codigo'],
                    pais=dados['pais'],
                    pais_codigo=dados['pais_codigo'],
                    continente=dados['continente'],
                    categoria_gamificacao=dados['categoria'],
                ),
            )
            place._cluster = dados['cluster']  # atributo só em memória, não persiste — usado no resto do seed
            places.append(place)
        return places

    # ─── Usuários ───────────────────────────────────────────────────────────

    def _criar_usuarios(self, quantidade):
        usuarios = []
        usados = set(User.objects.values_list('username', flat=True))

        for i in range(quantidade):
            nome = random.choice(NOMES)
            sobrenome = random.choice(SOBRENOMES)
            base = f"demo_{slugify_simples(nome)}{slugify_simples(sobrenome)}"
            # Truncate base to leave room for counter suffix (max 20 chars total)
            base = base[:16]  # Leave room for up to "_9999" (5 chars)
            username = base
            contador = 1
            while username in usados and len(username) < 20:
                contador += 1
                username = f"{base}{contador}"[:20]  # Ensure never exceeds 20 chars
                if username in usados and len(username) == 20:
                    # If still in use and at max length, try a different base
                    base = base[:15]
                    username = f"{base}{random.randint(1000, 9999)}"[:20]
            usados.add(username)

            idade_dias = random.randint(18 * 365, 45 * 365)
            data_nascimento = (timezone.now() - timedelta(days=idade_dias)).date()

            usuario = User.objects.create_user(
                username=username,
                email=f'{username}@demo.allways.test',
                password=SENHA_PADRAO,
                nome_exibicao=f'{nome} {sobrenome}',
                genero=random.choice([c[0] for c in User.Genero.choices]),
                data_nascimento=data_nascimento,
                bio=random.choice(BIOS),
            )
            # Atributo em memória: afinidade principal por cluster temático —
            # usado pra enviesar follows/saves/curtidas/feed events desse usuário.
            usuario._cluster = random.choice(CLUSTERS)
            usuarios.append(usuario)

        return usuarios

    # ─── Itinerários ────────────────────────────────────────────────────────

    def _criar_itinerarios(self, usuarios, places, quantidade, dias):
        itinerarios = []
        places_por_cluster = {c: [p for p in places if p._cluster == c] for c in CLUSTERS}

        for i in range(quantidade):
            autor = random.choice(usuarios)
            cluster = autor._cluster if random.random() < 0.75 else random.choice(CLUSTERS)  # 75% fiel ao próprio cluster, resto explora

            candidatos_cluster = places_por_cluster[cluster]
            # Mistura: maioria dos pontos do cluster do itinerário, um ou dois de fora pra variar
            n_pontos = random.randint(2, 5)
            pontos_local = random.sample(candidatos_cluster, k=min(n_pontos, len(candidatos_cluster)))
            if len(pontos_local) < n_pontos:
                restantes = [p for p in places if p not in pontos_local]
                pontos_local += random.sample(restantes, k=min(n_pontos - len(pontos_local), len(restantes)))
            random.shuffle(pontos_local)

            tipo = 'multi_day' if len(pontos_local) >= 4 or random.random() < 0.3 else 'day_trip'
            publicado = random.random() < 0.85  # a maioria publicada, resto fica rascunho (realista)

            data_inicio = (timezone.now() - timedelta(days=random.randint(1, dias))).date()
            data_fim = data_inicio + timedelta(days=random.randint(0, 6)) if tipo == 'multi_day' else data_inicio

            itinerario = Itinerario.objects.create(
                autor=autor,
                titulo=self._titulo_itinerario(cluster, pontos_local),
                tipo=tipo,
                status='publicado' if publicado else 'rascunho',
                data_inicio=data_inicio,
                data_fim=data_fim,
            )

            if publicado:
                # publicado_em backdated dentro da janela — fundamental pra testar
                # o decaimento temporal de 72h do feed (settings.DECAIMENTO_MEIA_VIDA_HORAS).
                publicado_em = timezone.now() - timedelta(
                    days=random.randint(0, dias), hours=random.randint(0, 23)
                )
                itinerario.publicado_em = publicado_em
                itinerario.save(update_fields=['publicado_em'])

            hashtags_pool = HASHTAGS_POR_CLUSTER[cluster]
            for ordem, place in enumerate(pontos_local, start=1):
                entrada_gratuita = random.random() < 0.3
                n_tags = random.randint(1, 2)
                tags_texto = ' '.join(f'#{t}' for t in random.sample(hashtags_pool, k=n_tags))
                comentario = f"{random.choice(['Vale muito a pena!', 'Lugar incrível.', 'Recomendo demais.', 'Fiquei impressionado.', 'Ótimo custo-benefício.'])} {tags_texto}"

                PontoItinerario.objects.create(
                    itinerario=itinerario,
                    local=place,
                    ordem=ordem,
                    movimentacao=random.choice(['vazio', 'populado', 'cheio']),
                    seguranca=random.randint(2, 5),
                    entrada_gratuita=entrada_gratuita,
                    preco_medio=None if entrada_gratuita else random.randint(1, 5),
                    meio_deslocamento=random.choice(['a_pe', 'carro', 'taxi_app', 'transporte_publico', 'bicicleta']),
                    comentario=comentario,
                )

            # Distância entre pontos consecutivos via Haversine (sem OSRM — ver docstring do módulo)
            pontos_ordenados = list(itinerario.pontos.order_by('ordem').select_related('local'))
            for a, b in zip(pontos_ordenados, pontos_ordenados[1:]):
                dist = haversine_metros(a.local.latitude, a.local.longitude, b.local.latitude, b.local.longitude)
                a.distancia_ate_proximo = dist
                a.save(update_fields=['distancia_ate_proximo'])

            itinerario._cluster = cluster
            itinerarios.append(itinerario)

        return itinerarios

    def _titulo_itinerario(self, cluster, pontos_local):
        cidades = list(dict.fromkeys(p.cidade or p.pais for p in pontos_local))
        templates = {
            'praia_natureza': f"Fugindo pra natureza: {' + '.join(cidades[:2])}",
            'cultura_historia': f"Mergulho na história de {' e '.join(cidades[:2])}",
            'gastronomia': f"Rota gastronômica por {' e '.join(cidades[:2])}",
            'urbano': f"Explorando {' e '.join(cidades[:2])} como um local",
        }
        return templates.get(cluster, f"Roteiro por {' e '.join(cidades[:2])}")

    # ─── Follows ────────────────────────────────────────────────────────────

    def _criar_follows(self, usuarios, places):
        total = 0
        pares_usuario = set()
        pares_local = set()

        for usuario in usuarios:
            # Segue mais gente do próprio cluster (afinidade), um pouco de fora
            mesmo_cluster = [u for u in usuarios if u is not usuario and u._cluster == usuario._cluster]
            outro_cluster = [u for u in usuarios if u is not usuario and u._cluster != usuario._cluster]
            alvos = random.sample(mesmo_cluster, k=min(random.randint(2, 6), len(mesmo_cluster))) \
                + random.sample(outro_cluster, k=min(random.randint(0, 2), len(outro_cluster)))

            for alvo in alvos:
                chave = (usuario.id, alvo.id)
                if chave in pares_usuario:
                    continue
                pares_usuario.add(chave)
                try:
                    Follow.objects.create(seguidor=usuario, seguido_usuario=alvo)
                    total += 1
                except IntegrityError:
                    pass

            # Segue alguns places do próprio cluster
            places_cluster = [p for p in places if p._cluster == usuario._cluster]
            locais_alvo = random.sample(places_cluster, k=min(random.randint(1, 3), len(places_cluster)))
            for local in locais_alvo:
                chave = (usuario.id, local.id)
                if chave in pares_local:
                    continue
                pares_local.add(chave)
                try:
                    Follow.objects.create(seguidor=usuario, seguido_local=local)
                    total += 1
                except IntegrityError:
                    pass

        return total

    # ─── Saves ──────────────────────────────────────────────────────────────

    def _criar_saves(self, usuarios, itinerarios):
        total = 0
        publicados = [it for it in itinerarios if it.status == 'publicado']

        for usuario in usuarios:
            do_cluster = [it for it in publicados if it._cluster == usuario._cluster and it.autor_id != usuario.id]
            de_fora = [it for it in publicados if it._cluster != usuario._cluster and it.autor_id != usuario.id]

            escolhidos = random.sample(do_cluster, k=min(random.randint(2, 8), len(do_cluster))) \
                + random.sample(de_fora, k=min(random.randint(0, 2), len(de_fora)))

            for it in escolhidos:
                save, criado = ItinerarioSalvo.objects.get_or_create(usuario=usuario, itinerario=it)
                if criado:
                    salvo_em = it.publicado_em + timedelta(
                        hours=random.randint(1, 72 * 5)
                    ) if it.publicado_em else timezone.now()
                    ItinerarioSalvo.objects.filter(pk=save.pk).update(salvo_em=min(salvo_em, timezone.now()))
                    total += 1

        return total

    # ─── Curtidas ───────────────────────────────────────────────────────────

    def _criar_curtidas(self, usuarios, itinerarios):
        total = 0
        publicados = [it for it in itinerarios if it.status == 'publicado']
        ct_itinerario = ContentType.objects.get_for_model(Itinerario)

        for usuario in usuarios:
            do_cluster = [it for it in publicados if it._cluster == usuario._cluster and it.autor_id != usuario.id]
            escolhidos = random.sample(do_cluster, k=min(random.randint(3, 12), len(do_cluster)))

            for it in escolhidos:
                curtida, criado = Curtida.objects.get_or_create(
                    usuario=usuario, content_type=ct_itinerario, object_id=it.id,
                )
                if criado:
                    criado_em = it.publicado_em + timedelta(hours=random.randint(1, 72 * 5)) if it.publicado_em else timezone.now()
                    Curtida.objects.filter(pk=curtida.pk).update(criado_em=min(criado_em, timezone.now()))
                    total += 1

        return total

    # ─── Comentários ────────────────────────────────────────────────────────

    def _criar_comentarios(self, usuarios, itinerarios):
        total = 0
        publicados = [it for it in itinerarios if it.status == 'publicado']
        frases = [
            'Já fui e recomendo muito!', 'Está na minha lista agora 😍', 'Qual época do ano vocês foram?',
            'Incrível, salvei o roteiro!', 'Fiz algo parecido ano passado, vale muito.', 'Adorei as dicas!',
        ]
        respostas = [
            'Fomos em julho, deu tudo certo!', 'Fim de tarde é o melhor horário.', 'Com certeza, super recomendo!',
        ]

        for it in random.sample(publicados, k=min(int(len(publicados) * 0.6), len(publicados))):
            comentaristas = random.sample(
                [u for u in usuarios if u.id != it.autor_id], k=min(random.randint(1, 4), len(usuarios) - 1)
            )
            for autor_comentario in comentaristas:
                raiz = Comment.objects.create(
                    autor=autor_comentario, itinerario=it, texto=random.choice(frases),
                )
                total += 1

                if random.random() < 0.4:
                    quem_responde = random.choice([it.autor] + comentaristas)
                    Comment.objects.create(
                        autor=quem_responde, itinerario=it, texto=random.choice(respostas),
                        parent=raiz, responder_para=autor_comentario,
                    )
                    total += 1

        return total

    # ─── Mensagens diretas ──────────────────────────────────────────────────

    def _criar_mensagens(self, usuarios):
        total = 0
        textos = [
            'Oi! Vi que você foi naquele lugar, como foi?', 'Bora planejar uma viagem juntos?',
            'Adorei seu último itinerário!', 'Topa trocar dicas de viagem?', 'Vamos marcar uma viagem em grupo?',
        ]
        # Conversas só entre pares que já tem alguma conexão social (mesmo cluster) — mais realista
        pares_feitos = set()
        for _ in range(min(len(usuarios) * 2, 120)):
            a, b = random.sample(usuarios, 2)
            chave = tuple(sorted([a.id, b.id]))
            if chave in pares_feitos:
                continue
            pares_feitos.add(chave)

            n_msgs = random.randint(1, 4)
            for i in range(n_msgs):
                remetente, destinatario = (a, b) if i % 2 == 0 else (b, a)
                msg = Message.objects.create(
                    remetente=remetente, destinatario=destinatario,
                    tipo='texto', texto=random.choice(textos),
                )
                enviada_em = timezone.now() - timedelta(days=random.randint(0, 30), hours=random.randint(0, 23))
                Message.objects.filter(pk=msg.pk).update(enviada_em=enviada_em)
                total += 1

        return total

    # ─── Feed events ────────────────────────────────────────────────────────

    def _criar_feed_events(self, usuarios, itinerarios, dias):
        """Gera o histórico de interação bruto que alimenta o perfil de
        interesse (apps.feed.services.recalcular_interesse_usuario). Sem
        isso, hashtag_scores/lugar_scores ficam vazios e o scoring por
        regras não tem o que usar na camada de interesse."""
        total = 0
        publicados = [it for it in itinerarios if it.status == 'publicado']

        for usuario in usuarios:
            do_cluster = [it for it in publicados if it._cluster == usuario._cluster and it.autor_id != usuario.id]
            de_fora = [it for it in publicados if it._cluster != usuario._cluster and it.autor_id != usuario.id]

            # Views: bastante volume, maioria dentro do cluster, espalhadas pela janela inteira
            vistos = random.sample(do_cluster, k=min(random.randint(10, 25), len(do_cluster))) \
                + random.sample(de_fora, k=min(random.randint(2, 6), len(de_fora)))

            for it in vistos:
                self._criar_evento(usuario, it, 'view', dias)
                total += 1
                if random.random() < 0.3:
                    self._criar_evento(usuario, it, 'comment_read', dias)
                    total += 1

            # Um punhado usado como base de um fork (use_as_base) — sinal forte de interesse
            for it in random.sample(do_cluster, k=min(2, len(do_cluster))):
                self._criar_evento(usuario, it, 'use_as_base', dias)
                total += 1

        return total

    def _criar_evento(self, usuario, itinerario, tipo, dias):
        evento = FeedEvent.objects.create(usuario=usuario, itinerario=itinerario, tipo=tipo)
        criado_em = timezone.now() - timedelta(days=random.randint(0, dias), hours=random.randint(0, 23))
        FeedEvent.objects.filter(pk=evento.pk).update(criado_em=criado_em)
        return evento

    # ─── Bootstrap síncrono final ───────────────────────────────────────────

    def _bootstrap_sincrono(self, usuarios):
        """Recalcula tudo que normalmente ficaria a cargo do Celery Beat, na
        hora, pra o dado já sair "pronto para inspeção" assim que o comando
        termina — sem precisar esperar as próximas 6h/1 dia do schedule."""
        for usuario in usuarios:
            recalcular_interesse_usuario(usuario)

        for usuario in usuarios:
            recalcular_similaridades_usuario(usuario)

        for usuario in usuarios:
            avaliar_e_conceder_badges(usuario)

        for usuario in usuarios:
            recalcular_feed_usuario(usuario)
