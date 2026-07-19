from django.shortcuts import get_object_or_404
from rest_framework import serializers
from apps.users.models import User
from apps.places.models import Place
from apps.itineraries.models import Itinerario
from apps.gamification.serializers import serializar_badge_destaque
from .models import Follow, Hashtag, Comment, Message, Notification


class HashtagSerializer(serializers.ModelSerializer):
    total_itinerarios = serializers.SerializerMethodField()

    class Meta:
        model = Hashtag
        fields = ['id', 'nome', 'total_itinerarios']

    def get_total_itinerarios(self, obj):
        return obj.itinerarios.filter(status='publicado').count()


class UsuarioResumoSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'foto_perfil']


class FollowSerializer(serializers.ModelSerializer):
    tipo = serializers.ChoiceField(choices=['usuario', 'local'], write_only=True)
    alvo_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = Follow
        fields = ['id', 'tipo', 'alvo_id', 'criado_em']
        read_only_fields = ['criado_em']

    def validate(self, data):
        request = self.context['request']
        tipo = data['tipo']
        alvo_id = data['alvo_id']

        if tipo == 'usuario':
            alvo = get_object_or_404(User, pk=alvo_id)
            if alvo == request.user:
                raise serializers.ValidationError("Você não pode seguir a si mesmo.")
            data['seguido_usuario'] = alvo
        else:
            data['seguido_local'] = get_object_or_404(Place, pk=alvo_id)

        return data

    def create(self, validated_data):
        validated_data.pop('tipo')
        validated_data.pop('alvo_id')
        validated_data['seguidor'] = self.context['request'].user
        return Follow.objects.create(**validated_data)


class CommentSerializer(serializers.ModelSerializer):
    autor_nome = serializers.CharField(source='autor.username', read_only=True)
    autor_foto = serializers.SerializerMethodField()
    autor_badge_destaque = serializers.SerializerMethodField()
    total_curtidas = serializers.SerializerMethodField()
    curtido = serializers.SerializerMethodField()
    responder_para_username = serializers.CharField(source='responder_para.username', read_only=True, default=None)
    respostas = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = [
            'id', 'autor', 'autor_nome', 'autor_foto', 'autor_badge_destaque',
            'itinerario', 'texto', 'criado_em', 'total_curtidas', 'curtido',
            'parent', 'responder_para', 'responder_para_username', 'respostas',
        ]
        read_only_fields = ['autor', 'criado_em']

    def get_autor_foto(self, obj):
        request = self.context.get('request')
        if obj.autor and obj.autor.foto_perfil:
            return request.build_absolute_uri(obj.autor.foto_perfil.url) if request else obj.autor.foto_perfil.url
        return None

    def get_autor_badge_destaque(self, obj):
        return serializar_badge_destaque(obj.autor, context=self.context)

    def get_respostas(self, obj):
        # Só o comentário raiz carrega respostas aninhadas — uma resposta nunca
        # tem `respostas` própria (thread de 1 nível só), então isso já vem vazio
        # naturalmente pra elas, sem precisar de um serializer separado.
        if obj.parent_id:
            return []
        return CommentSerializer(obj.respostas.all(), many=True, context=self.context).data

    def validate(self, data):
        parent = data.get('parent')
        if parent and parent.parent_id:
            raise serializers.ValidationError(
                "Respostas devem apontar `parent` para o comentário raiz da thread, não para outra resposta."
            )
        return data

    def _resumo_curtida(self, obj):
        if not hasattr(obj, '_resumo_curtida_cache'):
            from .services import resumo_curtida
            request = self.context.get('request')
            usuario = request.user if request else None
            obj._resumo_curtida_cache = resumo_curtida(obj, usuario)
        return obj._resumo_curtida_cache

    def get_total_curtidas(self, obj):
        return self._resumo_curtida(obj)['total_curtidas']

    def get_curtido(self, obj):
        return self._resumo_curtida(obj)['curtido']


class MessageSerializer(serializers.ModelSerializer):
    remetente_nome = serializers.CharField(source='remetente.username', read_only=True)
    remetente_foto = serializers.SerializerMethodField()
    destinatario_nome = serializers.CharField(source='destinatario.username', read_only=True)
    total_curtidas = serializers.SerializerMethodField()
    curtido = serializers.SerializerMethodField()
    video_thumbnail_url = serializers.SerializerMethodField()

    # Escrita: cliente manda só o id; restrito a itinerários publicados —
    # não dá pra compartilhar rascunho de ninguém (nem o próprio).
    itinerario_id = serializers.PrimaryKeyRelatedField(
        source='itinerario', queryset=Itinerario.objects.filter(status='publicado'),
        write_only=True, required=False,
    )
    # Leitura: preview compacto pro balão de chat. 'disponivel: False' cobre tanto
    # o caso do SET_NULL (itinerário apagado) quanto o autor ter voltado pra rascunho.
    itinerario = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            'id', 'remetente', 'remetente_nome', 'remetente_foto',
            'destinatario', 'destinatario_nome',
            'tipo', 'texto', 'imagem', 'audio',
            'video', 'video_thumbnail_url', 'video_status', 'duracao_segundos',
            'itinerario_id', 'itinerario', 'enviada_em',
            'total_curtidas', 'curtido',
        ]
        # video_status e duracao_segundos são preenchidos pelo servidor
        # (upload seta duração; a task Celery seta status='pronto'/'erro')
        read_only_fields = ['remetente', 'enviada_em', 'video_status', 'duracao_segundos']

    def get_video_thumbnail_url(self, obj):
        request = self.context.get('request')
        if not obj.video_thumbnail:
            return None
        return request.build_absolute_uri(obj.video_thumbnail.url) if request else obj.video_thumbnail.url

    def get_remetente_foto(self, obj):
        request = self.context.get('request')
        if obj.remetente and obj.remetente.foto_perfil:
            return request.build_absolute_uri(obj.remetente.foto_perfil.url) if request else obj.remetente.foto_perfil.url
        return None

    def get_itinerario(self, obj):
        if obj.tipo != 'itinerario':
            return None
        it = obj.itinerario
        if it is None or it.status != 'publicado':
            return {'disponivel': False}

        primeiro_ponto = it.pontos.first()
        return {
            'disponivel': True,
            'id': it.id,
            'titulo': it.titulo,
            'tipo': it.tipo,
            'lugar_principal': {'nome': primeiro_ponto.local.nome} if primeiro_ponto else None,
            'total_pontos': it.pontos.count(),
            'autor_username': it.autor.username if it.autor else None,
        }

    def _resumo_curtida(self, obj):
        if not hasattr(obj, '_resumo_curtida_cache'):
            from .services import resumo_curtida
            request = self.context.get('request')
            usuario = request.user if request else None
            obj._resumo_curtida_cache = resumo_curtida(obj, usuario)
        return obj._resumo_curtida_cache

    def get_total_curtidas(self, obj):
        return self._resumo_curtida(obj)['total_curtidas']

    def get_curtido(self, obj):
        return self._resumo_curtida(obj)['curtido']

    def validate(self, data):
        tipo = data.get('tipo', 'texto')
        if tipo == 'texto' and not data.get('texto', '').strip():
            raise serializers.ValidationError("Mensagem de texto não pode ser vazia.")
        if tipo == 'imagem' and not data.get('imagem'):
            raise serializers.ValidationError("Mensagem de imagem requer um arquivo.")
        if tipo == 'audio' and not data.get('audio'):
            raise serializers.ValidationError("Mensagem de áudio requer um arquivo.")
        if tipo == 'video' and not data.get('video'):
            raise serializers.ValidationError("Mensagem de vídeo requer um arquivo.")
        if tipo == 'itinerario' and not data.get('itinerario'):
            raise serializers.ValidationError("Mensagem de itinerário requer um itinerario_id válido e publicado.")
        return data

class NotificationSerializer(serializers.ModelSerializer):
    ator_username = serializers.CharField(source='ator.username', read_only=True)
    ator_foto = serializers.SerializerMethodField()
    mensagem = serializers.SerializerMethodField()
    link = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ['id', 'tipo', 'ator', 'ator_username', 'ator_foto', 'mensagem', 'link', 'lida', 'criado_em']
        read_only_fields = fields

    def get_ator_foto(self, obj):
        request = self.context.get('request')
        if obj.ator and obj.ator.foto_perfil:
            return request.build_absolute_uri(obj.ator.foto_perfil.url) if request else obj.ator.foto_perfil.url
        return None

    def get_mensagem(self, obj):
        nome = obj.ator.username if obj.ator else 'Alguém'
        return {
            'follow': f'{nome} começou a seguir você',
            'comentario': f'{nome} comentou no seu itinerário',
            'resposta_comentario': f'{nome} respondeu seu comentário',
            'mensagem': f'{nome} enviou uma mensagem',
            'curtida': f'{nome} curtiu algo seu',
        }.get(obj.tipo, '')

    def get_link(self, obj):
        # Import local pra evitar import circular no topo do módulo.
        from apps.itineraries.models import Itinerario, PontoItinerario
        alvo = obj.alvo

        if obj.tipo == 'follow':
            return f'/perfil/{obj.ator.username}' if obj.ator else None

        if obj.tipo == 'comentario':
            # alvo é o Itinerario (é o que o signal de comentário de 1º nível manda).
            return f'/itinerario/{alvo.id}' if alvo else None

        if obj.tipo == 'resposta_comentario':
            # alvo é o Comment respondido.
            return f'/itinerario/{alvo.itinerario_id}' if alvo else None

        if obj.tipo == 'mensagem':
            return f'/mensagens?usuario={obj.ator.username}' if obj.ator else None

        if obj.tipo == 'curtida':
            if isinstance(alvo, Itinerario):
                return f'/itinerario/{alvo.id}'
            if isinstance(alvo, Comment):
                return f'/itinerario/{alvo.itinerario_id}'
            if isinstance(alvo, PontoItinerario):
                return f'/place/{alvo.local_id}'
            if isinstance(alvo, Message):
                return f'/mensagens?usuario={obj.ator.username}' if obj.ator else None
            return None

        return None