from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            model_name='User',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('xblock_id', models.CharField(max_length=70)),
                ('task_id', models.CharField(max_length=70)),
                ('code', models.TextField()),
                ('code_result', models.BooleanField()),
            ],
        ),
    ]