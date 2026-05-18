import { useMemo, useState, type ReactElement } from 'react'
import { useMutation } from '@tanstack/react-query'
import { MessageCircleWarning, ShieldCheck, Search, Crosshair, AlertTriangle } from 'lucide-react'

import {
  analyzeText,
  type TextAnalysisResponse,
  type ToxicSpan,
} from '../lib/api'

function sortSpans(spans: ToxicSpan[]): ToxicSpan[] {
  return [...spans].sort((first, second) => first.start - second.start)
}

function renderHighlightedText(transcript: string, spans: ToxicSpan[]) {
  if (!transcript) return null

  if (!spans.length) {
    return <span className="text-slate-200">{transcript}</span>
  }

  const elements: ReactElement[] = []
  let cursor = 0

  sortSpans(spans).forEach((span, index) => {
    const safeStart = Math.max(0, Math.min(span.start, transcript.length))
    const safeEnd = Math.max(safeStart, Math.min(span.end, transcript.length))

    if (safeStart > cursor) {
      elements.push(<span key={`normal-${index}`} className="text-slate-200">{transcript.slice(cursor, safeStart)}</span>)
    }

    elements.push(
      <mark
        key={`toxic-${index}`}
        className="rounded bg-amber-500/30 px-1 text-amber-200 ring-1 ring-amber-400/50 font-medium"
        title="Từ ngữ tiêu cực"
      >
        {transcript.slice(safeStart, safeEnd)}
      </mark>,
    )

    cursor = safeEnd
  })

  if (cursor < transcript.length) {
    elements.push(<span key="normal-last" className="text-slate-200">{transcript.slice(cursor)}</span>)
  }

  return <>{elements}</>
}

function percentage(value: number) {
  return `${Math.round(value * 100)}%`
}

export function CommentAnalysisPage() {
  const [commentText, setCommentText] = useState('')
  const [commentResult, setCommentResult] = useState<TextAnalysisResponse | null>(null)
  const [commentError, setCommentError] = useState<string | null>(null)

  const classifyMutation = useMutation({
    mutationFn: (text: string) => analyzeText(text, false),
    onSuccess: (payload) => {
      setCommentResult(payload)
      setCommentError(null)
    },
    onError: (error) => {
      setCommentError((error as Error).message)
    },
  })

  const analyzeSpanMutation = useMutation({
    mutationFn: (text: string) => analyzeText(text, true),
    onSuccess: (payload) => {
      setCommentResult(payload)
      setCommentError(null)
    },
    onError: (error) => {
      setCommentError((error as Error).message)
    },
  })

  const commentToxicWordList = useMemo(() => {
    if (!commentResult?.toxic_spans?.length) {
      return []
    }
    return [...new Set(commentResult.toxic_spans.map((span) => span.word))]
  }, [commentResult?.toxic_spans])

  const handleClassifyComment = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!commentText.trim()) {
      setCommentError('Vui lòng nhập văn bản cần kiểm tra.')
      return
    }
    classifyMutation.mutate(commentText)
  }

  const handleAnalyzeSpans = () => {
    if (!commentText.trim()) return
    analyzeSpanMutation.mutate(commentText)
  }

  const displayError =
    commentError ?? (classifyMutation.error as Error | undefined)?.message ?? (analyzeSpanMutation.error as Error | undefined)?.message

  return (
    <div className="flex flex-col md:flex-row gap-8">
      {/* Cột trái: Form Nhập */}
      <div className="w-full md:w-5/12 flex flex-col gap-6">
        <div className="space-y-3">
          <h2 className="text-3xl font-bold text-white tracking-tight">Theo dõi bình luận</h2>
          <p className="text-slate-400 leading-relaxed">
            Công cụ quét nhanh văn bản để nhận diện các bình luận độc hại, thô tục hoặc mang ý tính công kích. Hệ thống sử dụng mô hình học sâu để đưa ra đánh giá chính xác.
          </p>
        </div>

        <form onSubmit={handleClassifyComment} className="flex flex-col gap-4">
          <div className="relative">
            <textarea
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              rows={8}
              placeholder="Nhập hoặc dán bình luận người dùng vào đây..."
              className="w-full resize-none rounded-3xl border border-white/10 bg-white/5 p-6 text-[15px] leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-amber-400/50 focus:bg-white/10 focus:outline-none focus:ring-4 focus:ring-amber-400/10 transition-all shadow-inner"
            />
            {commentText.trim().length > 0 && (
              <div className="absolute bottom-4 right-6 text-xs font-medium text-slate-500">
                {commentText.length} ký tự
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={classifyMutation.isPending || !commentText.trim()}
            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-white px-6 py-4 text-sm font-bold text-slate-950 transition-all hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
          >
            {classifyMutation.isPending ? (
              <>
                <Search className="h-5 w-5 animate-spin" />
                Đang quét nội dung...
              </>
            ) : (
              <>
                Kiểm duyệt bình luận này
              </>
            )}
          </button>
        </form>

        {displayError && (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 font-medium text-rose-200">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p className="text-sm">{displayError}</p>
          </div>
        )}

        {/* Info box */}
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 flex gap-4">
          <MessageCircleWarning className="h-6 w-6 text-amber-400 shrink-0" />
          <div className="text-sm text-amber-200/80 leading-relaxed font-medium">
            Mẹo: Để tối ưu tốc độ, hệ thống sẽ chỉ đánh giá tổng quan (Có vi phạm hay không). Nếu phát hiện vi phạm, bạn có thể bấm nút "Định vị vị trí vi phạm" để xem chi tiết từng từ.
          </div>
        </div>
      </div>

      {/* Cột phải: Kết quả */}
      <div className="w-full md:w-7/12">
        <div className="h-full rounded-[2rem] border border-white/10 bg-slate-900/40 p-6 backdrop-blur-md lg:p-8 flex flex-col shadow-2xl relative overflow-hidden">
          
          <div className="relative z-10 flex items-center justify-between border-b border-white/5 pb-5">
            <h3 className="text-xl font-semibold text-white">Báo cáo đánh giá</h3>
            {commentResult && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-slate-300">
                Độ tin cậy: <span className="text-white">{percentage(commentResult.confidence)}</span>
              </div>
            )}
          </div>

          <div className="relative z-10 flex-1 mt-6 flex flex-col gap-6">
            {!commentResult ? (
              <div className="flex h-full items-center justify-center flex-col text-slate-500 gap-4">
                <Search className="h-10 w-10 opacity-20" />
                <p>Nội dung phân tích sẽ được báo cáo chi tiết tại bảng này.</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {/* Result Card 1 */}
                  <div className={`p-5 rounded-2xl border ${commentResult.is_toxic ? 'bg-rose-500/10 border-rose-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Trạng thái</h4>
                    <div className="flex items-center gap-3">
                      {commentResult.is_toxic ? (
                        <>
                          <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                          <span className="text-xl font-bold text-rose-400">Vi phạm</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-6 h-6 text-emerald-400" />
                          <span className="text-xl font-bold text-emerald-400">An toàn</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Result Card 2 */}
                  <div className="p-5 rounded-2xl border bg-white/5 border-white/10 flex flex-col justify-center items-start">
                    {commentResult.is_toxic ? (
                      <button
                        type="button"
                        onClick={handleAnalyzeSpans}
                        disabled={analyzeSpanMutation.isPending || commentResult.has_toxic_spans}
                        className="w-full flex items-center justify-center gap-2 bg-amber-400 text-slate-950 px-4 py-2.5 rounded-xl font-bold text-[13px] hover:bg-amber-300 transition-colors disabled:bg-slate-700 disabled:text-slate-400"
                      >
                        {analyzeSpanMutation.isPending ? (
                          'Đang dò định vị...'
                        ) : commentResult.has_toxic_spans ? (
                          'Đã định vị thành công'
                        ) : (
                          <>
                            <Crosshair className="w-4 h-4" />
                            Định vị mã vi phạm (Chi tiết)
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="text-slate-400 text-sm font-medium w-full text-center">
                        Nội dung bình thường, không cần định vị chi tiết.
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1 flex flex-col bg-slate-950/50 border border-white/5 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-white/5 bg-white/5">
                    <h4 className="font-semibold text-sm text-slate-300">Nội dung xét duyệt:</h4>
                  </div>
                  <div className="p-6 text-[15px] leading-8">
                    {renderHighlightedText(commentResult.processed_text, commentResult.toxic_spans)}
                  </div>
                </div>

                {commentToxicWordList.length > 0 && (
                  <div className="mt-4 p-5 rounded-2xl bg-amber-500/5 border border-amber-500/10">
                    <h4 className="font-medium text-amber-300/80 mb-3 text-sm">Danh sách các từ khóa vi phạm được trích xuất:</h4>
                    <div className="flex flex-wrap gap-2">
                      {commentToxicWordList.map((word) => (
                        <span key={word} className="rounded-lg border border-amber-500/30 bg-amber-500/20 px-3 py-1.5 text-sm font-bold text-amber-200">
                          {word}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
