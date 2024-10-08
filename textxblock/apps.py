from django.apps import AppConfig

class TextXBlockConfig(AppConfig):
    name = 'textxblock'
    verbose_name = 'Text XBlock'
    def ready(self):
        from . import migrations
        from django.core.management import call_command
