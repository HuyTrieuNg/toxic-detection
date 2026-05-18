import { useMemo, useState, type ReactElement } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { UploadCloud, CheckCircle2, AlertTriangle, ShieldCheck, Activity } from 'lucide-react'

import {
  fetchJobStatus,
  type JobResponse,
  type ToxicSpan,
  uploadMedia,
} from '../lib/api'

function sortSpans(spans: ToxicSpan[]): ToxicSpan[] {
  return [...spans].sort((first, second) => first.start - second.start)
}

function renderHighlightedText(transcript: string, spans: ToxicSpan[]) {
  if (!transcript) {
    return <span className="text-slate-400">Hệ thống đang chờ dữ liệu...</span>
  }

  if (!spans.length) {
    return <span className="text-slate-100">{transcript}</span>
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
        className="rounded bg-rose-500/30 px-1 text-rose-200 ring-1 ring-rose-400/50 font-medium"
        title="Nội dung vi phạm"
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

export function MediaAnalysisPage() {
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
        return 2000
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
    if (!file) return
    uploadMutation.mutate(file)
  }

  return (
    <div className="flex flex-col md:flex-row gap-8">
      {/* Cột trái: Form Upload */}
      <div className="w-full md:w-5/12 lg:w-1/3 flex flex-col gap-6">
        <div className="space-y-3">
          <h2 className="text-3xl font-bold text-white tracking-tight">Ký âm & Lọc nội dung</h2>
          <p className="text-slate-400 leading-relaxed">
            Tải lên tệp âm thanh hoặc video. Trí tuệ nhân tạo sẽ tự động chuyển đổi giọng nói thành văn bản và khoanh vùng chính xác các từ ngữ vi phạm tiêu chuẩn cộng đồng.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label 
            className={`
              relative group flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed 
              p-10 transition-all cursor-pointer overflow-hidden
              ${file ? 'border-cyan-400 bg-cyan-400/5' : 'border-white/10 bg-white/5 hover:border-cyan-400/50 hover:bg-white/10'}
            `}
          >
            <div className={`absolute inset-0 bg-gradient-to-t from-cyan-500/10 to-transparent opacity-0 transition-opacity ${file ? 'opacity-100' : 'group-hover:opacity-100'}`} />
            
            <div className={`p-4 rounded-full transition-colors ${file ? 'bg-cyan-400 text-slate-950' : 'bg-white/10 text-white'}`}>
              <UploadCloud className="w-8 h-8" />
            </div>
            
            <div className="text-center relative z-10">
              {file ? (
                <p className="font-semibold text-cyan-300">{file.name}</p>
              ) : (
                <p className="font-medium text-slate-300">Nhấn để chọn file Audio/Video</p>
              )}
              <p className="mt-2 text-xs text-slate-500">Hỗ trợ các định dạng phổ biến (MP3, WAV, MP4, MOV...)</p>
            </div>

            <input
              type="file"
              accept="audio/*,video/*"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>

          <button
            type="submit"
            disabled={!file || uploadMutation.isPending}
            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-white px-6 py-4 text-sm font-bold text-slate-950 transition-all hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
          >
            {uploadMutation.isPending ? (
              <>
                <Activity className="h-5 w-5 animate-pulse" />
                Đang đẩy dữ liệu lên máy chủ...
              </>
            ) : (
              <>
                Phân tích tệp này ngay
              </>
            )}
          </button>
        </form>

        {uploadMutation.error && (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 font-medium text-rose-200">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p className="text-sm">{(uploadMutation.error as Error).message}</p>
          </div>
        )}

        <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-5 space-y-4">
          <div className="flex items-center gap-3 text-slate-300 font-medium">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <h3>Đảm bảo riêng tư & bảo mật</h3>
          </div>
          <ul className="space-y-2 text-sm text-slate-400">
            <li className="flex gap-2"><div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5 shrink-0"/> Xử lý hoàn toàn tự động bởi AI.</li>
            <li className="flex gap-2"><div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5 shrink-0"/> Dữ liệu không được lưu trữ lâu dài.</li>
            <li className="flex gap-2"><div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5 shrink-0"/> Trả kết quả theo thời gian thực (ước tính).</li>
          </ul>
        </div>
      </div>

      {/* Cột phải: Kết quả */}
      <div className="w-full md:w-7/12 lg:w-2/3">
        <div className="h-full rounded-[2rem] border border-white/10 bg-slate-900/40 p-6 backdrop-blur-md lg:p-8 flex flex-col shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/5 pb-5">
            <h3 className="text-xl font-semibold text-white">Kết quả kiểm duyệt</h3>
            {isProcessing && (
              <div className="flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                </span>
                Hệ thống đang xử lý...
              </div>
            )}
            {statusQuery.data?.status === 'completed' && (
              <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                Hoàn tất phân tích
              </div>
            )}
          </div>

          <div className="flex-1 mt-6 flex flex-col gap-6">
            {!jobId ? (
              <div className="flex h-full items-center justify-center flex-col text-slate-500 gap-4">
                <Activity className="h-10 w-10 opacity-20" />
                <p>Hãy tải lên một tệp ở cột bên trái để xem kết quả tại đây.</p>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-4 p-5 rounded-2xl bg-white/5 border border-white/5">
                  <div className={`p-2.5 rounded-full shrink-0 ${statusQuery.data?.status === 'failed' ? 'bg-rose-500/20 text-rose-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
                    {statusQuery.data?.status === 'failed' ? <AlertTriangle className="w-5 h-5"/> : <Activity className="w-5 h-5"/>}
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-200 uppercase text-xs tracking-wider mb-1">Trạng thái tác vụ</h4>
                    <p className="text-slate-300 font-medium">
                      {statusQuery.data?.message ?? 'Đang kết nối máy chủ...'}
                    </p>
                    {statusQuery.data?.error_message && (
                      <p className="mt-2 text-sm text-rose-400 bg-rose-500/10 p-3 rounded-lg border border-rose-500/20">
                        {statusQuery.data.error_message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex-1 flex flex-col min-h-[300px] gap-6">
                  {statusQuery.data?.original_file_url && (
                    <div className="w-full flex-col flex items-center justify-center bg-black/40 rounded-2xl border border-white/5 overflow-hidden">
                      {statusQuery.data.media_type === 'video' ? (
                        <video 
                          controls 
                          src={statusQuery.data.original_file_url} 
                          className="w-full max-h-[350px] object-contain"
                        />
                      ) : (
                        <audio 
                          controls 
                          src={statusQuery.data.original_file_url} 
                          className="w-full max-w-md my-6"
                        />
                      )}
                    </div>
                  )}
                  
                  <div className="flex flex-col flex-1">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-semibold text-slate-300">Văn bản được nhận diện (Ký âm có đánh dấu)</h4>
                      {toxicWordList.length > 0 && (
                        <span className="text-xs font-medium bg-rose-500/20 text-rose-300 px-2.5 py-1 rounded-md">
                          Phát hiện {statusQuery.data?.toxic_spans?.length} điểm vi phạm
                        </span>
                      )}
                    </div>
                    <div className="flex-1 rounded-2xl border border-white/5 bg-slate-950/50 p-6 leading-8 text-slate-200">
                      {statusQuery.data?.transcript ? (
                        renderHighlightedText(statusQuery.data.transcript, statusQuery.data.toxic_spans ?? [])
                      ) : (
                        <div className="h-full flex items-center justify-center text-slate-600">
                          {isProcessing ? 'Đang chuyển đổi giọng nói thành văn bản...' : 'Chưa có dữ liệu'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {toxicWordList.length > 0 && (
                  <div className="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/10">
                    <h4 className="font-medium text-rose-300 mb-3 text-sm">Các từ khóa đã vi phạm tiêu chuẩn:</h4>
                    <div className="flex flex-wrap gap-2">
                      {toxicWordList.map((word) => (
                        <span key={word} className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-1.5 text-sm font-medium text-rose-200">
                          {word}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
