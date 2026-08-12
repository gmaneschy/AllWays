from django.utils import timezone
from rest_framework import serializers
from apps.gamification.models import BadgeItinerario, ItinerarioBadge
from apps.gamification.serializers import BadgeItinerarioSerializer, BadgeUsuarioSerializer
from .models import Itinerario, PontoItinerario, FotoPontoItinerario, VideoPontoItinerario
from . import services as itinerario_services


class PontoItinerarioSerializer(serializers.ModelSerializer):
    local_nome = serializers.CharField(source='local.nome', read_only=True)
    # Num ModelSerializer aninhado 'id' normalmente vem read-only. Aqui
    # precisa ser gravável (mas opcional) pra permitir, ao ATUALIZAR um
    # itinerário, casar cada ponto do payload com o registro já existente no
    # banco em vez de apagar e recriar tudo — apagar destruiria (via
    # CASCADE) as fotos/vídeos já enviados pro ponto. Ver
    # services.sincronizar_pontos_itinerario, que é o único lugar que
    # efetivamente usa esse id (sempre restrito aos pontos do próprio
    # itinerário sendo atualizado — um id de outro itinerário é ignorado,
    # não sequestrado).
    id = serializers.IntegerField(required=False)

    class Meta:
        model = PontoItinerario
        fields = [
            'id', 'local', 'local_nome', 'ordem',
            'movimentacao', 'seguranca',
            'entrada_gratuita', 'preco_medio',
            'distancia_ate_proximo', 'meio_deslocamento',
            'horario_estimado', 'comentario',
        ]
        read_only_fields = ['distancia_ate_proximo']

    # Não há validate() aqui de propósito: a regra "gratuito não pode ter
    # preço / não-gratuito precisa de preço" só se aplica na PUBLICAÇÃO,
    # não no salvamento do rascunho (ver comentário em
    # ItinerarioSerializer.validate() e services.CAMPOS_OBRIGATORIOS_PONTO).
    # Um rascunho em andamento pode perfeitamente ter um ponto sem essa
    # decisão ainda tomada. A checagem de fato acontece em
    # services.validar_itinerario_para_publicacao, chamada só na transição
    # rascunho → publicado (POST /itinerarios/{id}/publicar/). Validar aqui
    # também bloqueava incondicionalmente até o salvamento de rascunho.


class ItinerarioSerializer(serializers.ModelSerializer):
    """Usado na criação/edição (CriarItinerario.jsx). O campo 'badges' recebe
    uma lista de IDs de BadgeItinerario (múltiplos permitidos, ex: econômico + relaxante)."""
    pontos = PontoItinerarioSerializer(many=True)
    autor_nome = serializers.CharField(source='autor.username', read_only=True)
    badges = serializers.PrimaryKeyRelatedField(
        queryset=BadgeItinerario.objects.all(), many=True, required=False, write_only=True,
    )
    badges_detalhe = serializers.SerializerMethodField()

    class Meta:
        model = Itinerario
        fields = [
            'id', 'autor', 'autor_nome', 'titulo', 'tipo', 'status',
            'data_inicio', 'data_fim', 'publicado_em',
            'itinerario_original', 'pontos', 'badges', 'badges_detalhe',
        ]
        read_only_fields = ['autor', 'publicado_em']

    def get_badges_detalhe(self, obj):
        if obj.pk is None:
            return []
        ids = obj.badges.values_list('badge_id', flat=True)
        badges = BadgeItinerario.objects.filter(id__in=ids)
        return BadgeItinerarioSerializer(badges, many=True, context=self.context).data

    def validate_pontos(self, value):
        if len(value) == 0:
            raise serializers.ValidationError("O itinerário precisa de pelo menos 1 local.")
        return value

    def validate_data_inicio(self, value):
        if value and value > timezone.now().date():
            raise serializers.ValidationError("A data do itinerário não pode ser no futuro.")
        return value

    def validate(self, data):
        """Publicar não passa mais por aqui. Na criação, mídia ainda não existe
        (é enviada depois, já com os IDs dos pontos); então a validação completa
        de "pronto pra publicar" (campos obrigatórios + mídia por ponto) só faz
        sentido rodar depois do upload, no endpoint dedicado
        POST /itinerarios/{id}/publicar/ (ver views.py + services.py)."""
        status_novo = data.get('status')
        ja_publicado = self.instance is not None and self.instance.status == 'publicado'

        if status_novo == 'publicado' and not ja_publicado:
            raise serializers.ValidationError({
                'status': "Não é possível publicar diretamente por aqui. Salve como rascunho, "
                          "envie as fotos/vídeos de cada ponto e então chame "
                          "POST /itinerarios/{id}/publicar/."
            })
        return data

    def create(self, validated_data):
        pontos_data = validated_data.pop('pontos')
        badges_data = validated_data.pop('badges', [])

        itinerario = Itinerario.objects.create(**validated_data)

        for ponto_data in pontos_data:
            PontoItinerario.objects.create(itinerario=itinerario, **ponto_data)

        for badge in badges_data:
            ItinerarioBadge.objects.get_or_create(itinerario=itinerario, badge=badge)

        itinerario_services.calcular_distancias_itinerario(itinerario)
        return itinerario

    def update(self, instance, validated_data):
        """Badges são substituídos por completo a cada update — mais simples e
        previsível do lado do frontend do que um diff incremental. Pontos são
        SINCRONIZADOS (casados por id quando o payload manda um, senão
        criados) em vez de apagados e recriados — ver
        services.sincronizar_pontos_itinerario; apagar destruiria (via
        CASCADE) fotos/vídeos já enviados, o que quebraria justamente o
        cenário que motivou pontos serem editáveis por aqui: reabrir um
        rascunho que falhou na publicação, corrigir um campo e tentar de
        novo sem perder a mídia já enviada.

        'status' só chega aqui como 'publicado' se já estava publicado
        (validate() acima barra a transição rascunho→publicado nesse
        endpoint), então não há publicado_em pra recalcular."""
        badges_data = validated_data.pop('badges', None)
        pontos_data = validated_data.pop('pontos', None)

        for campo, valor in validated_data.items():
            setattr(instance, campo, valor)
        instance.save()

        if pontos_data is not None:
            itinerario_services.sincronizar_pontos_itinerario(instance, pontos_data)
            itinerario_services.calcular_distancias_itinerario(instance)

        if badges_data is not None:
            ItinerarioBadge.objects.filter(itinerario=instance).delete()
            for badge in badges_data:
                ItinerarioBadge.objects.get_or_create(itinerario=instance, badge=badge)

        return instance


class FotoPontoItinerarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = FotoPontoItinerario
        fields = ['id', 'ponto', 'imagem', 'enviada_em']
        read_only_fields = ['enviada_em']


class FotoPontoDetalheSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = FotoPontoItinerario
        fields = ['id', 'url', 'enviada_em']

    def get_url(self, obj):
        request = self.context.get('request')
        return request.build_absolute_uri(obj.imagem.url) if request else obj.imagem.url


class VideoPontoItinerarioSerializer(serializers.ModelSerializer):
    """Usado na criação (upload). Campos derivados da compressão (thumbnail,
    duração, status) são preenchidos pela task Celery, não pelo cliente."""

    class Meta:
        model = VideoPontoItinerario
        fields = ['id', 'ponto', 'video', 'thumbnail', 'duracao_segundos', 'status', 'enviado_em']
        read_only_fields = ['thumbnail', 'duracao_segundos', 'status', 'enviado_em']


class VideoPontoDetalheSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = VideoPontoItinerario
        fields = ['id', 'url', 'thumbnail_url', 'duracao_segundos', 'status', 'enviado_em']

    def get_url(self, obj):
        request = self.context.get('request')
        if not obj.video:
            return None
        return request.build_absolute_uri(obj.video.url) if request else obj.video.url

    def get_thumbnail_url(self, obj):
        request = self.context.get('request')
        if not obj.thumbnail:
            return None
        return request.build_absolute_uri(obj.thumbnail.url) if request else obj.thumbnail.url


class PontoDetalheSerializer(serializers.ModelSerializer):
    local_nome = serializers.CharField(source='local.nome', read_only=True)
    local_endereco = serializers.CharField(source='local.endereco', read_only=True)
    local_id = serializers.IntegerField(source='local.id', read_only=True)
    fotos = FotoPontoDetalheSerializer(many=True, read_only=True)
    videos = VideoPontoDetalheSerializer(many=True, read_only=True)

    class Meta:
        model = PontoItinerario
        fields = [
            'id', 'ordem', 'local_id', 'local_nome', 'local_endereco',
            'movimentacao', 'seguranca', 'entrada_gratuita', 'preco_medio',
            'distancia_ate_proximo', 'meio_deslocamento', 'horario_estimado',
            'comentario', 'fotos', 'videos',
        ]


class ItinerarioDetalheSerializer(serializers.ModelSerializer):
    """Usado na página do post (PaginaItinerario.jsx), feed e explorar —
    já traz a badge de destaque do autor e as badges do itinerário juntas,
    pra exibir tudo ao lado do nome/card sem requisição extra."""
    pontos = PontoDetalheSerializer(many=True, read_only=True)
    autor_username = serializers.CharField(source='autor.username', read_only=True)
    autor_foto = serializers.SerializerMethodField()
    autor_badge_destaque = serializers.SerializerMethodField()
    badges = serializers.SerializerMethodField()
    salvo_por_mim = serializers.SerializerMethodField()
    total_curtidas = serializers.SerializerMethodField()
    curtido = serializers.SerializerMethodField()

    class Meta:
        model = Itinerario
        fields = [
            'id', 'titulo', 'tipo', 'status', 'data_inicio', 'data_fim',
            'publicado_em', 'autor', 'autor_username', 'autor_foto',
            'autor_badge_destaque', 'badges', 'salvo_por_mim',
            'total_curtidas', 'curtido', 'pontos',
        ]

    def get_autor_foto(self, obj):
        request = self.context.get('request')
        if obj.autor and obj.autor.foto_perfil:
            return request.build_absolute_uri(obj.autor.foto_perfil.url) if request else obj.autor.foto_perfil.url
        return None

    def get_badges(self, obj):
        from apps.gamification.serializers import BadgeItinerarioSerializer
        ids = obj.badges.values_list('badge_id', flat=True)
        badges = BadgeItinerario.objects.filter(id__in=ids)
        return BadgeItinerarioSerializer(badges, many=True, context=self.context).data

    def get_autor_badge_destaque(self, obj):
        from apps.gamification.serializers import serializar_badge_destaque
        return serializar_badge_destaque(obj.autor, context=self.context)

    def get_salvo_por_mim(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.salvos_por.filter(usuario=request.user).exists()

    def _resumo_curtida(self, obj):
        if not hasattr(obj, '_resumo_curtida_cache'):
            from apps.social.services import resumo_curtida
            request = self.context.get('request')
            usuario = request.user if request else None
            obj._resumo_curtida_cache = resumo_curtida(obj, usuario)
        return obj._resumo_curtida_cache

    def get_total_curtidas(self, obj):
        return self._resumo_curtida(obj)['total_curtidas']

    def get_curtido(self, obj):
        return self._resumo_curtida(obj)['curtido']