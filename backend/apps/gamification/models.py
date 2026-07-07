from django.db import models


class BadgeItinerario(models.Model):
    """Selo escolhido pelo próprio autor ao criar o post
    (categorias do itinerário: caro, econômico, cansativo, relaxante etc.)."""
    nome = models.CharField(max_length=50)
    icone = models.ImageField(upload_to='badges/itinerario/')

    def __str__(self):
        return self.nome


class TipoBadgeUsuario(models.Model):
    """Família de badge de usuário, ex: 'Viajante Local', 'Peregrino'."""
    nome = models.CharField(max_length=50, unique=True)
    descricao = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return self.nome


class BadgeUsuario(models.Model):
    """Selo concedido pela plataforma com base no comportamento do usuário.
    Cada linha é um NÍVEL dentro de uma família (tipo)."""

    NIVEL_BRONZE = 'bronze'
    NIVEL_PRATA = 'prata'
    NIVEL_OURO = 'ouro'
    NIVEL_DIAMANTE = 'diamante'
    NIVEL_CHOICES = [
        (NIVEL_BRONZE, 'Bronze'),
        (NIVEL_PRATA, 'Prata'),
        (NIVEL_OURO, 'Ouro'),
        (NIVEL_DIAMANTE, 'Diamante'),
    ]

    CRITERIO_LUGARES_DISTINTOS_CIDADE = 'lugares_distintos_cidade'
    CRITERIO_CIDADES_DISTINTAS_REGIAO = 'cidades_distintas_regiao'
    CRITERIO_PERCENTUAL_REGIOES_PAIS = 'percentual_regioes_pais'
    CRITERIO_PERCENTUAL_PAISES_CONTINENTE = 'percentual_paises_continente'
    CRITERIO_CONTINENTES_VISITADOS = 'continentes_visitados'
    CRITERIO_PERCENTUAL_PAISES_MUNDO = 'percentual_paises_mundo'
    CRITERIO_KM_A_PE = 'km_a_pe'
    CRITERIO_KM_CARRO_MOTO_TAXI = 'km_carro_moto_taxi'
    CRITERIO_KM_TRANSPORTE_PUBLICO = 'km_transporte_publico'
    CRITERIO_KM_BICICLETA = 'km_bicicleta'
    CRITERIO_POLOS_VISITADOS = 'polos_visitados'
    CRITERIO_LUGARES_CULTURAIS = 'lugares_culturais'
    CRITERIO_LUGARES_RELIGIOSOS = 'lugares_religiosos'
    CRITERIO_LUGARES_GASTRONOMICOS = 'lugares_gastronomicos'

    CRITERIO_CHOICES = [
        (CRITERIO_LUGARES_DISTINTOS_CIDADE, 'Lugares distintos em uma cidade'),
        (CRITERIO_CIDADES_DISTINTAS_REGIAO, 'Cidades distintas em uma região'),
        (CRITERIO_PERCENTUAL_REGIOES_PAIS, '% de regiões visitadas em um país'),
        (CRITERIO_PERCENTUAL_PAISES_CONTINENTE, '% de países visitados em um continente'),
        (CRITERIO_CONTINENTES_VISITADOS, 'Nº de continentes visitados'),
        (CRITERIO_PERCENTUAL_PAISES_MUNDO, '% de países visitados no mundo'),
        (CRITERIO_KM_A_PE, 'Km percorridos a pé'),
        (CRITERIO_KM_CARRO_MOTO_TAXI, 'Km percorridos de carro/moto/táxi/app'),
        (CRITERIO_KM_TRANSPORTE_PUBLICO, 'Km percorridos de transporte público'),
        (CRITERIO_KM_BICICLETA, 'Km percorridos de bicicleta'),
        (CRITERIO_POLOS_VISITADOS, 'Polos visitados (Ártico/Antártida)'),
        (CRITERIO_LUGARES_CULTURAIS, 'Lugares culturais visitados'),
        (CRITERIO_LUGARES_RELIGIOSOS, 'Lugares religiosos visitados'),
        (CRITERIO_LUGARES_GASTRONOMICOS, 'Lugares gastronômicos visitados'),
    ]

    tipo = models.ForeignKey(TipoBadgeUsuario, on_delete=models.CASCADE, related_name='niveis')
    nivel = models.CharField(max_length=10, choices=NIVEL_CHOICES)
    nome = models.CharField(max_length=50)
    icone = models.ImageField(upload_to='badges/usuario/')
    criterio_campo = models.CharField(max_length=30, choices=CRITERIO_CHOICES)
    criterio_valor = models.FloatField(
        help_text="Valor mínimo para conquistar este nível. Contagem absoluta ou percentual (0–100), conforme o critério."
    )

    class Meta:
        unique_together = ('tipo', 'nivel')
        ordering = ['tipo', 'criterio_valor']

    def __str__(self):
        return f"{self.nome} ({self.get_nivel_display()})"


class ItinerarioBadge(models.Model):
    """Relação: qual badge o autor escolheu para aquele itinerário."""
    itinerario = models.ForeignKey('itineraries.Itinerario', on_delete=models.CASCADE, related_name='badges')
    badge = models.ForeignKey('gamification.BadgeItinerario', on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['itinerario', 'badge'], name='badge_unica_por_itinerario')
        ]


class UsuarioBadge(models.Model):
    """Relação: quais badges (níveis) o usuário já conquistou.

    'contexto' guarda o nome da cidade/região/país/continente quando o critério
    é geográfico com contexto — permite conquistar o mesmo nível mais de uma vez
    (ex: Viajante Local Bronze em Fortaleza E, separadamente, em Recife)."""
    usuario = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='badges')
    badge = models.ForeignKey('gamification.BadgeUsuario', on_delete=models.CASCADE, related_name='conquistas')
    contexto = models.CharField(max_length=100, blank=True)
    conquistado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['usuario', 'badge', 'contexto'], name='conquista_unica_por_contexto')
        ]

    def __str__(self):
        sufixo = f" — {self.contexto}" if self.contexto else ""
        return f"{self.usuario.username}: {self.badge.nome}{sufixo}"