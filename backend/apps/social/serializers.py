from django.shortcuts import get_object_or_404
from rest_framework import serializers
from apps.users.models import User
from apps.places.models import Place
from .models import Follow, Hashtag, Comment, Message


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
    """Alvo informado via 'tipo' (usuario|local) + 'alvo_id'.
    Follow de hashtag foi removido."""

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

    class Meta:
        model = Comment
        fields = ['id', 'autor', 'autor_nome', 'autor_foto', 'itinerario', 'texto', 'criado_em']
        read_only_fields = ['autor', 'criado_em']

    def get_autor_foto(self, obj):
        request = self.context.get('request')
        if obj.autor and obj.autor.foto_perfil:
            return request.build_absolute_uri(obj.autor.foto_perfil.url) if request else obj.autor.foto_perfil.url
        return None


class MessageSerializer(serializers.ModelSerializer):
    remetente_nome = serializers.CharField(source='remetente.username', read_only=True)
    remetente_foto = serializers.SerializerMethodField()
    destinatario_nome = serializers.CharField(source='destinatario.username', read_only=True)

    class Meta:
        model = Message
        fields = [
            'id', 'remetente', 'remetente_nome', 'remetente_foto',
            'destinatario', 'destinatario_nome',
            'tipo', 'texto', 'imagem', 'audio', 'enviada_em',
        ]
        read_only_fields = ['remetente', 'enviada_em']

    def get_remetente_foto(self, obj):
        request = self.context.get('request')
        if obj.remetente and obj.remetente.foto_perfil:
            return request.build_absolute_uri(obj.remetente.foto_perfil.url) if request else obj.remetente.foto_perfil.url
        return None

    def validate(self, data):
        tipo = data.get('tipo', 'texto')
        if tipo == 'texto' and not data.get('texto', '').strip():
            raise serializers.ValidationError("Mensagem de texto não pode ser vazia.")
        if tipo == 'imagem' and not data.get('imagem'):
            raise serializers.ValidationError("Mensagem de imagem requer um arquivo.")
        if tipo == 'audio' and not data.get('audio'):
            raise serializers.ValidationError("Mensagem de áudio requer um arquivo.")
        return data