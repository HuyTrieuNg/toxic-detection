import { Link, Outlet, useLocation } from 'react-router-dom'
import { FileAudio, MessageSquareText, ShieldAlert } from 'lucide-react'

export function Layout() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500/30">
      {/* Background gradients */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.1),_transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(251,191,36,0.1),_transparent_40%)]" />

      {/* Navigation Bar */}
      <header className="relative z-10 border-b border-white/10 bg-slate-950/50 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-emerald-500 shadow-lg shadow-cyan-500/20">
              <ShieldAlert className="h-5 w-5 text-slate-950" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-wide">SafeGuard AI</h1>
              <p className="text-xs text-slate-400 font-medium tracking-wider">HỆ THỐNG KIỂM DUYỆT NỘI DUNG</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-2 p-1 border border-white/10 rounded-full bg-white/5">
            <Link
              to="/media"
              className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all ${
                location.pathname === '/media' || location.pathname === '/'
                  ? 'bg-white text-slate-950 shadow-md shadow-white/10'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <FileAudio className="h-4 w-4" />
              Video & Âm thanh
            </Link>
            <Link
              to="/comments"
              className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all ${
                location.pathname === '/comments'
                  ? 'bg-white text-slate-950 shadow-md shadow-white/10'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <MessageSquareText className="h-4 w-4" />
              Bình luận
            </Link>
          </nav>
          
          {/* Mobile nav indicator */}
          <div className="md:hidden text-sm font-medium text-cyan-400">
            {location.pathname === '/comments' ? 'Bình luận' : 'Video & Âm thanh'}
          </div>
        </div>
        {/* Mobile Navigation Row */}
        <div className="md:hidden flex border-t border-white/5 flex-row">
            <Link
              to="/media"
              className={`flex-1 flex justify-center items-center gap-2 py-3 text-sm font-medium transition-all ${
                location.pathname === '/media' || location.pathname === '/'
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <FileAudio className="h-4 w-4" />
              Video & Audio
            </Link>
            <Link
              to="/comments"
              className={`flex-1 flex justify-center items-center gap-2 py-3 text-sm font-medium transition-all border-l border-white/5 ${
                location.pathname === '/comments'
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <MessageSquareText className="h-4 w-4" />
              Bình luận
            </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 mx-auto w-full max-w-7xl px-4 py-8 md:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}
