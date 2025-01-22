from .textxblock import TextXBlock
from .tasks import task_method
from . import urls as textxblock_urls

def get_urls():
    return textxblock_urls.urlpatterns