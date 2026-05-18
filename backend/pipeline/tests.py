from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase

from pipeline.models import ProcessingJob
from pipeline.services.audio import infer_media_type


class AudioServiceTests(TestCase):
    def test_infer_media_type_audio(self):
        self.assertEqual(infer_media_type('demo.mp3'), 'audio')

    def test_infer_media_type_video(self):
        self.assertEqual(infer_media_type('demo.mp4'), 'video')


class UploadApiTests(TestCase):
    def setUp(self):
        self.client = Client()

    @patch('pipeline.views.start_processing_thread')
    def test_upload_job_creates_queued_job(self, mocked_start_thread):
        sample_file = SimpleUploadedFile(
            'sample.mp3',
            b'fake-audio-content',
            content_type='audio/mpeg',
        )

        response = self.client.post('/api/jobs/upload/', data={'file': sample_file})

        self.assertEqual(response.status_code, 202)
        payload = response.json()
        self.assertIn('job_id', payload)

        job = ProcessingJob.objects.get(id=payload['job_id'])
        self.assertEqual(job.status, ProcessingJob.Status.QUEUED)
        self.assertEqual(job.media_type, ProcessingJob.MediaType.AUDIO)
        mocked_start_thread.assert_called_once()

    def test_upload_invalid_extension_returns_400(self):
        sample_file = SimpleUploadedFile(
            'sample.txt',
            b'invalid-content',
            content_type='text/plain',
        )

        response = self.client.post('/api/jobs/upload/', data={'file': sample_file})

        self.assertEqual(response.status_code, 400)
        self.assertIn('error', response.json())

    def test_job_status_endpoint_returns_job_payload(self):
        sample_file = SimpleUploadedFile(
            'sample.mp3',
            b'fake-audio-content',
            content_type='audio/mpeg',
        )

        job = ProcessingJob.objects.create(
            original_file=sample_file,
            media_type=ProcessingJob.MediaType.AUDIO,
            status=ProcessingJob.Status.COMPLETED,
            transcript='xin chao',
            toxic_spans=[{'word': 'ngu', 'start': 0, 'end': 3, 'label': 'Toxic'}],
            progress_message='Completed',
        )

        response = self.client.get(f'/api/jobs/{job.id}/')

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['status'], ProcessingJob.Status.COMPLETED)
        self.assertEqual(payload['transcript'], 'xin chao')
        self.assertEqual(len(payload['toxic_spans']), 1)


class TextAnalyzeApiTests(TestCase):
    def setUp(self):
        self.client = Client()

    @patch('pipeline.views.analyze_text')
    def test_analyze_comment_returns_binary_result(self, mocked_analyze_text):
        mocked_analyze_text.return_value = {
            'input_text': 'Ban co doc khong',
            'processed_text': 'ban co doc khong',
            'is_toxic': False,
            'label': 'NONE',
            'label_id': 0,
            'confidence': 0.98,
            'toxic_probability': 0.02,
            'toxic_spans': [],
            'has_toxic_spans': False,
        }

        response = self.client.post(
            '/api/text/analyze/',
            data='{"text":"Ban co doc khong","include_spans":false}',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertFalse(payload['is_toxic'])
        self.assertEqual(payload['label'], 'NONE')
        mocked_analyze_text.assert_called_once_with('Ban co doc khong', include_spans=False)

    @patch('pipeline.views.analyze_text')
    def test_analyze_comment_with_spans(self, mocked_analyze_text):
        mocked_analyze_text.return_value = {
            'input_text': 'mày ngu quá',
            'processed_text': 'mày ngu quá',
            'is_toxic': True,
            'label': 'TOXIC',
            'label_id': 1,
            'confidence': 0.97,
            'toxic_probability': 0.97,
            'toxic_spans': [
                {'word': 'ngu', 'start': 4, 'end': 7, 'label': 'Toxic', 'score': 0.97},
            ],
            'has_toxic_spans': True,
        }

        response = self.client.post(
            '/api/text/analyze/',
            data='{"text":"mày ngu quá","include_spans":true}',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload['is_toxic'])
        self.assertEqual(len(payload['toxic_spans']), 1)
