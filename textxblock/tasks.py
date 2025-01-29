from celery import shared_task
import requests

#app = Celery('tasks', backend='rpc://', broker='pyamqp://')

@shared_task
def task_method(data_dict ):
    server_address = 'http://host.docker.internal:3000/'
    response = requests.post(url = server_address, json =  data_dict)
    res = response.json()
    print(res)
    return res


