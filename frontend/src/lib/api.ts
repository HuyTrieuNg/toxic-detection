export type ToxicSpan = {
  word: string
  start: number
  end: number
  label: string
}

export type JobResponse = {
  job_id: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  message: string
  media_type: 'audio' | 'video'
  original_file_url: string | null
  audio_file_url: string | null
  transcript: string
  toxic_spans: ToxicSpan[]
  error_message: string
  created_at: string
  updated_at: string
}

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api'

export async function uploadMedia(file: File): Promise<{ job_id: string; status: string; message: string }> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE}/jobs/upload/`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Upload failed' }))
    throw new Error(body.error ?? 'Upload failed')
  }

  return response.json()
}

export async function fetchJobStatus(jobId: string): Promise<JobResponse> {
  const response = await fetch(`${API_BASE}/jobs/${jobId}/`)

  if (!response.ok) {
    throw new Error('Cannot fetch processing status')
  }

  return response.json()
}
