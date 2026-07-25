import { Routes, Route, Navigate } from 'react-router-dom';
import GuidancePage from './pages/GuidancePage';
import MangaPage from './pages/MangaPage';
import PreviewCameraPage from './pages/PreviewCameraPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<GuidancePage />} />
      <Route path="/manga" element={<MangaPage />} />
      <Route path="/preview-camera" element={<PreviewCameraPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

