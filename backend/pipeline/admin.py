from django.contrib import admin

from pipeline.models import ProcessingJob


@admin.register(ProcessingJob)
class ProcessingJobAdmin(admin.ModelAdmin):
    list_display = ('id', 'media_type', 'status', 'created_at', 'updated_at')
    search_fields = ('id', 'transcript')
    list_filter = ('status', 'media_type', 'created_at')
