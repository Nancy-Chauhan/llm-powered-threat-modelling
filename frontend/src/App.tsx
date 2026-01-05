import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ThreatModelList } from './pages/ThreatModelList';
import { CreateThreatModel } from './pages/CreateThreatModel';
import { ThreatModelView } from './pages/ThreatModelView';
import { SharedThreatModel } from './pages/SharedThreatModel';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<ThreatModelList />} />
        <Route path="new" element={<CreateThreatModel />} />
        <Route path="threat-models/:id" element={<ThreatModelView />} />
      </Route>
      <Route path="/shared/:token" element={<SharedThreatModel />} />
    </Routes>
  );
}
