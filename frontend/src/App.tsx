import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { MediaAnalysisPage } from './pages/MediaAnalysisPage'
import { CommentAnalysisPage } from './pages/CommentAnalysisPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          {/* Default redirect to media */}
          <Route index element={<Navigate to="/media" replace />} />
          <Route path="media" element={<MediaAnalysisPage />} />
          <Route path="comments" element={<CommentAnalysisPage />} />
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/media" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
