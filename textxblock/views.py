from django.http import JsonResponse    
from django.views.decorators.csrf import csrf_exempt
import json

@csrf_exempt
def receive_results(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        print(data, "receive results executing...................................................................1.11.1.1.1.1.1.1.1..11.")
        return JsonResponse(data)
    else:
        return JsonResponse({'error': 'Invalid request method'})

