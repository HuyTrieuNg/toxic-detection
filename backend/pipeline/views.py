import json

from django.http import HttpRequest, HttpResponseBadRequest, JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from pipeline.models import ProcessingJob
from pipeline.services.audio import UnsupportedMediaError, infer_media_type
from pipeline.services.inference import analyze_text
from pipeline.services.orchestrator import start_processing_thread


@csrf_exempt
@require_POST
def upload_job(request: HttpRequest):
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


@csrf_exempt
@require_POST
def analyze_comment(request: HttpRequest):
    try:
        payload = json.loads(request.body.decode('utf-8') or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON body'}, status=400)

    text = (payload.get('text') or '').strip()
    include_spans = bool(payload.get('include_spans', False))

    if not text:
        return JsonResponse({'error': 'Missing text field'}, status=400)

    return JsonResponse(analyze_text(text, include_spans=include_spans), status=200)
