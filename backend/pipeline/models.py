import uuid

from django.db import models


class ProcessingJob(models.Model):
    class Status(models.TextChoices):
        QUEUED = 'queued', 'Queued'
        PROCESSING = 'processing', 'Processing'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'

    class MediaType(models.TextChoices):
        AUDIO = 'audio', 'Audio'
        VIDEO = 'video', 'Video'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    original_file = models.FileField(upload_to='uploads/%Y/%m/%d/')
    audio_file = models.FileField(upload_to='audio/%Y/%m/%d/', null=True, blank=True)
    media_type = models.CharField(max_length=12, choices=MediaType.choices)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.QUEUED)
    progress_message = models.CharField(max_length=255, blank=True, default='Waiting to process')
    transcript = models.TextField(blank=True, default='')
    toxic_spans = models.JSONField(default=list, blank=True)
    error_message = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def as_dict(self, request=None):
        original_file_url = self.original_file.url if self.original_file else None
        audio_file_url = self.audio_file.url if self.audio_file else None

        if request is not None:
            if original_file_url:
                original_file_url = request.build_absolute_uri(original_file_url)
            if audio_file_url:
                audio_file_url = request.build_absolute_uri(audio_file_url)

        return {
            'job_id': str(self.id),
            'status': self.status,
            'message': self.progress_message,
            'media_type': self.media_type,
            'original_file_url': original_file_url,
            'audio_file_url': audio_file_url,
            'transcript': self.transcript,
            'toxic_spans': self.toxic_spans,
            'error_message': self.error_message,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
        }
