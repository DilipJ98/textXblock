from django.db import models


class User(models.Model):
    xblock_id = models.CharField(max_length= 70)
    task_id = models.CharField(max_length= 70)
    code = models.TextField()
    code_result = models.BooleanField()


    class Meta:
        app_label = 'textxblock'