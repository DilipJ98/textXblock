from celery import shared_task
import requests

#app = Celery('tasks', backend='rpc://', broker='pyamqp://')

def task_method(data_dict, submission_id ):
    server_address = 'http://host.docker.internal:3000/'
    headers = {
        'Content-Type' :'application/json',
        'x-submission-id': submission_id
    }
    response = requests.post(url = server_address, json =  data_dict, headers = headers)
    res = response.json()
    print(res, " from task method")
    return res