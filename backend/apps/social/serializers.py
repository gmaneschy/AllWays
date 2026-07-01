from django.shortcuts import get_object_or_404
from rest_framework import serializers
from apps.users.models import User
from apps.places.models import Place
from .models import Follow, Hashtag, Comment


class HashtagSerializer(serializers.ModelSerializer):
    total_seguidores = serializers.SerializerMethodField()

    class Meta:
        model = Hashtag
        fields = ['id', 'nome', 'total_seguidores']

    def get_total_seguidores(self, obj):
        return obj.seguidores.count()


class UsuarioResumoSerializer(serializers.ModelSerializer):
    """Versão compacta de User para listas de seguidores/seguindo."""
    class Meta:
        model = User
        fields = ['id', 'username', 'foto_perfil']


class FollowSerializer(serializers.ModelSerializer):
    """Serializer de criação. O alvo é informado via 'tipo' + 'alvo_id'
    em vez de expor os três FKs diretamente — evita o cliente mandar
    mais de um alvo preenchido sem precisar duplicar validação aqui
    (a constraint do banco já impede, mas validar antes dá erro mais claro)."""

    tipo = serializers.ChoiceField(choices=['usuario', 'local', 'hashtag'], write_only=True)
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
        elif tipo == 'local':
            data['seguido_local'] = get_object_or_404(Place, pk=alvo_id)
        else:
            data['seguido_hashtag'] = get_object_or_404(Hashtag, pk=alvo_id)

        return data

    def create(self, validated_data):
        validated_data.pop('tipo')
        validated_data.pop('alvo_id')
        validated_data['seguidor'] = self.context['request'].user
        return Follow.objects.create(**validated_data)


class CommentSerializer(serializers.ModelSerializer):
    autor_nome = serializers.CharField(source='autor.username', read_only=True)
    autor_foto = serializers.ImageField(source='autor.foto_perfil', read_only=True)

    class Meta:
        model = Comment
        fields = ['id', 'autor', 'autor_nome', 'autor_foto', 'itinerario', 'texto', 'criado_em']
        read_only_fields = ['autor', 'criado_em']