import json

from django.http import HttpRequest, HttpResponseBadRequest, JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET

from pipeline.models import ProcessingJob
from pipeline.services.audio import UnsupportedMediaError, infer_media_type
from pipeline.services.orchestrator import start_processing_thread


@csrf_exempt

def upload_job(request: HttpRequest):
    if request.method != 'POST':
        return HttpResponseBadRequest(
            json.dumps({'error': 'Only POST is supported'}),
            content_type='application/json',
        )

    upload = request.FILES.get('file')
    if upload is None:
        return JsonResponse({'error': 'Missing file field'}, status=400)

    try:
        media_type = infer_media_type(upload.name)
    except UnsupportedMediaError as exc:
        return JsonResponse({'error': str(exc)}, status=400)

    job = ProcessingJob.objects.create(
        original_file=upload,
        media_type=media_type,
        status=ProcessingJob.Status.QUEUED,
        progress_message='Queued for processing',
    )

    start_processing_thread(str(job.id))

    return JsonResponse(
        {
            'job_id': str(job.id),
            'status': job.status,
            'message': job.progress_message,
        },
        status=202,
    )


@require_GET
def job_status(request: HttpRequest, job_id: str):
    job = get_object_or_404(ProcessingJob, id=job_id)
    return JsonResponse(job.as_dict(request=request), status=200)
