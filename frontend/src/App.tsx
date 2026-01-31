import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ThreatModelList } from './pages/ThreatModelList';
import { CreateThreatModel } from './pages/CreateThreatModel';
import { ThreatModelView } from './pages/ThreatModelView';
import { SharedThreatModel } from './pages/SharedThreatModel';

export default function App() {
  return (
    <>
      <Toaster position="top-right" richColors />
      <Routes>
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ThreatModelList />} />
        <Route path="new" element={<CreateThreatModel />} />
        <Route path="threat-models/:id" element={<ThreatModelView />} />
      </Route>
      {/* Shared links remain public */}
      <Route path="/shared/:token" element={<SharedThreatModel />} />
    </Routes>
    </>
  );
}
