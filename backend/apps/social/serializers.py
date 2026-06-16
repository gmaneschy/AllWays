"""
No caso do autor do comentário ser None, isto é, se a conta do usuário foi desativada ou apagada,
esta classe faz o tratamento da exibição do comentário, exibindo "Usuário removido".

class CommentSerializer(serializers.ModelSerializer):
    autor_nome = serializers.SerializerMethodField()

    def get_autor_nome(self, obj):
        return obj.autor.username if obj.autor else "Usuário removido"

    class Meta:
        model = Comment
        fields = ['id', 'autor_nome', 'local', 'texto']
"""