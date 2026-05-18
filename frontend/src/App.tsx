import { useMemo, useState, type ReactElement } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import { fetchJobStatus, type JobResponse, type ToxicSpan, uploadMedia } from './lib/api'

function sortSpans(spans: ToxicSpan[]): ToxicSpan[] {
  return [...spans].sort((first, second) => first.start - second.start)
}

function renderHighlightedText(transcript: string, spans: ToxicSpan[]) {
  if (!transcript) {
    return <span className="text-slate-400">Chưa có transcript.</span>
  }

  if (!spans.length) {
    return <span className="text-slate-800">{transcript}</span>
  }

  const elements: ReactElement[] = []
  let cursor = 0

  sortSpans(spans).forEach((span, index) => {
    const safeStart = Math.max(0, Math.min(span.start, transcript.length))
    const safeEnd = Math.max(safeStart, Math.min(span.end, transcript.length))

    if (safeStart > cursor) {
      elements.push(<span key={`normal-${index}`}>{transcript.slice(cursor, safeStart)}</span>)
    }

    elements.push(
      <mark
        key={`toxic-${index}`}
        className="rounded bg-rose-200 px-1 text-rose-900"
        title="Toxic word"
      >
        {transcript.slice(safeStart, safeEnd)}
      </mark>,
    )

    cursor = safeEnd
  })

  if (cursor < transcript.length) {
    elements.push(<span key="normal-last">{transcript.slice(cursor)}</span>)
  }

  return <>{elements}</>
}

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)

  const uploadMutation = useMutation({
    mutationFn: uploadMedia,
    onSuccess: (payload) => {
      setJobId(payload.job_id)
    },
  })

  const statusQuery = useQuery({
    queryKey: ['job-status', jobId],
    queryFn: () => fetchJobStatus(jobId as string),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = (query.state.data as JobResponse | undefined)?.status
      if (!status || status === 'queued' || status === 'processing') {
        return 1500
      }
      return false
    },
  })

  const isProcessing =
    uploadMutation.isPending ||
    statusQuery.data?.status === 'queued' ||
    statusQuery.data?.status === 'processing'

  const toxicWordList = useMemo(() => {
    if (!statusQuery.data?.toxic_spans?.length) {
      return []
    }
    return [...new Set(statusQuery.data.toxic_spans.map((span) => span.word))]
  }, [statusQuery.data?.toxic_spans])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!file) {
      return
    }
    uploadMutation.mutate(file)
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Toxic Audio Detection</h1>
          <p className="mt-2 text-sm text-slate-600">
            Upload audio/video, hệ thống sẽ tách audio (nếu cần), nhận diện transcript và tô màu từ toxic.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">1. Upload file</h2>
          <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
            <input
              type="file"
              accept="audio/*,video/*"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="block w-full rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm"
            />
            <button
              type="submit"
              disabled={!file || uploadMutation.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {uploadMutation.isPending ? 'Đang upload...' : 'Upload & Process'}
            </button>
          </form>
          {uploadMutation.error && (
            <p className="mt-3 text-sm text-rose-600">{(uploadMutation.error as Error).message}</p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">2. Processing status</h2>
          {!jobId && <p className="mt-3 text-sm text-slate-500">Chưa có job nào được tạo.</p>}
          {jobId && (
            <div className="mt-3 space-y-2 text-sm">
              <p>
                <span className="font-semibold">Job ID:</span> {jobId}
              </p>
              <p>
                <span className="font-semibold">Status:</span>{' '}
                <span className="capitalize">{statusQuery.data?.status ?? 'loading'}</span>
              </p>
              <p>
                <span className="font-semibold">Message:</span>{' '}
                {statusQuery.data?.message ?? 'Đang lấy trạng thái...'}
              </p>
              {isProcessing && <p className="text-blue-600">Đang xử lý, tự động cập nhật mỗi 1.5s...</p>}
              {statusQuery.error && (
                <p className="text-rose-600">{(statusQuery.error as Error).message}</p>
              )}
              {statusQuery.data?.error_message && (
                <p className="text-rose-600">{statusQuery.data.error_message}</p>
              )}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">3. Transcript & Toxic highlight</h2>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 leading-7">
            {renderHighlightedText(statusQuery.data?.transcript ?? '', statusQuery.data?.toxic_spans ?? [])}
          </div>
          <div className="mt-4 text-sm">
            <span className="font-semibold">Toxic words:</span>{' '}
            {toxicWordList.length ? toxicWordList.join(', ') : 'Không có'}
          </div>
        </section>
      </div>
    </main>
  )
}

export default App
