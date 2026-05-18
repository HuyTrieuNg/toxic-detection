from django.urls import path

from pipeline.views import analyze_comment, job_status, upload_job

urlpatterns = [
    path('jobs/upload/', upload_job, name='upload-job'),
    path('jobs/<uuid:job_id>/', job_status, name='job-status'),
    path('text/analyze/', analyze_comment, name='analyze-comment'),
]
