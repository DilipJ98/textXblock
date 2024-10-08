from celery import shared_task
import requests

#app = Celery('tasks', backend='rpc://', broker='pyamqp://')

@shared_task
def task_method(message, id):
    server_address = 'http://host.docker.internal:3000/'
    code = {
        "code" : message
    }
    response = requests.post(url = server_address, json =  code)
    res = response.json()
    print(res)
    return res


