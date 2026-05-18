from pathlib import Path
from threading import Thread

from django.conf import settings
from django.core.files import File

from pipeline.models import ProcessingJob
from pipeline.services.audio import extract_audio
from pipeline.services.inference import detect_toxic_spans, transcribe_audio


def process_job(job_id: str) -> None:
    job = ProcessingJob.objects.get(id=job_id)

    extracted_path: Path | None = None
    try:
        job.status = ProcessingJob.Status.PROCESSING
        job.progress_message = 'Extracting audio...'
        job.error_message = ''
        job.save(update_fields=['status', 'progress_message', 'error_message', 'updated_at'])

        output_dir = Path(settings.MEDIA_ROOT) / 'temp_audio' / str(job.id)
        extracted_path, should_cleanup = extract_audio(
            input_path=job.original_file.path,
            media_type=job.media_type,
            output_dir=output_dir,
        )

        with extracted_path.open('rb') as audio_fp:
            job.audio_file.save(extracted_path.name, File(audio_fp), save=False)

        job.progress_message = 'Running speech-to-text...'
        job.save(update_fields=['audio_file', 'progress_message', 'updated_at'])

        transcript = transcribe_audio(job.audio_file.path)

        job.progress_message = 'Detecting toxic words...'
        job.transcript = transcript
        job.save(update_fields=['progress_message', 'transcript', 'updated_at'])

        toxic_spans = detect_toxic_spans(transcript)

        job.status = ProcessingJob.Status.COMPLETED
        job.progress_message = 'Completed'
        job.toxic_spans = toxic_spans
        job.save(update_fields=['status', 'progress_message', 'toxic_spans', 'updated_at'])

        if should_cleanup and extracted_path.exists():
            extracted_path.unlink(missing_ok=True)
            if output_dir.exists() and not any(output_dir.iterdir()):
                output_dir.rmdir()
    except Exception as exc:
        job.status = ProcessingJob.Status.FAILED
        job.progress_message = 'Failed'
        job.error_message = str(exc)
        job.save(update_fields=['status', 'progress_message', 'error_message', 'updated_at'])


def start_processing_thread(job_id: str) -> None:
    worker = Thread(target=process_job, args=(job_id,), daemon=True)
    worker.start()
