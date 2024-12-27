from celery import shared_task
import requests

#app = Celery('tasks', backend='rpc://', broker='pyamqp://')

@shared_task
def task_method(message, xblock_id, user_id, instructor_data ):
    
    server_address = 'http://host.docker.internal:3000/'
    code = {
        "code" : message,
        "xblock_id" : xblock_id,
        "user_id" : user_id,
        "instructor_data" : instructor_data
    }
    response = requests.post(url = server_address, json =  code)
    res = response.json()
    print(res)
    return res


