from django.conf.urls import url
from .views import receive_results



urlpatterns = [
    url(r'^receive_results/$', receive_results, name='receive_results'),
]