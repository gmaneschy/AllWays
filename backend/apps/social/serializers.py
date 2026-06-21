from rest_framework import serializers
from .models import Follow, Message, Comment, Hashtag


class FollowSerializer(serializers.ModelSerializer):
    class Meta:
        model = Follow
        fields = ['id', 'seguidor', 'seguido_usuario', 'seguido_local', 'seguido_hashtag']
        read_only_fields = ['seguidor']

    def validate(self, data):
        alvos = [data.get('seguido_usuario'), data.get('seguido_local'), data.get('seguido_hashtag')]
        preenchidos = [a for a in alvos if a is not None]

        if len(preenchidos) == 0:
            raise serializers.ValidationError(
                "É necessário informar um usuário, local ou hashtag para seguir."
            )
        if len(preenchidos) > 1:
            raise serializers.ValidationError(
                "Só é possível seguir um tipo de alvo por vez (usuário, local ou hashtag)."
            )
        return data


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ['id', 'remetente', 'destinatario', 'texto']
        read_only_fields = ['remetente']


class CommentSerializer(serializers.ModelSerializer):
    autor_nome = serializers.SerializerMethodField()

    def get_autor_nome(self, obj):
        return obj.autor.username if obj.autor else "Usuário removido"

    class Meta:
        model = Comment
        fields = ['id', 'autor', 'autor_nome', 'itinerario', 'texto']
        read_only_fields = ['autor']


class HashtagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Hashtag
        fields = ['id', 'nome']