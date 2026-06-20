from django.contrib import admin
from .models import Follow, Message, Comment, Hashtag

# Register your models here.

admin.site.register(Follow)
admin.site.register(Message)
admin.site.register(Comment)
admin.site.register(Hashtag)