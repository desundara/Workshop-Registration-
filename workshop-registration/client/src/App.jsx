import { Navigate, Route, Routes } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import { EmptyState, Spinner } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Workshops from './pages/Workshops.jsx';
import WorkshopDetail from './pages/WorkshopDetail.jsx';
import Users from './pages/Users.jsx';
import Audit from './pages/Audit.jsx';

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
}

// UI-level guard only (nicer than a blank page). The real enforcement is on the API.
function Guard({ perm, children }) {
  const { can } = useAuth();
  if (!can(perm)) {
    return <EmptyState icon={ShieldAlert} title="You don't have access to this page">Your role doesn't include this area. Ask an administrator if you think that's a mistake.</EmptyState>;
  }
  return children;
}

function Home() {
  const { can } = useAuth();
  return <Navigate to={can('workshops:read') ? '/workshops' : '/users'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected />}>
        <Route index element={<Home />} />
        <Route path="/workshops" element={<Guard perm="workshops:read"><Workshops /></Guard>} />
        <Route path="/workshops/:id" element={<Guard perm="workshops:read"><WorkshopDetail /></Guard>} />
        <Route path="/users" element={<Guard perm="users:manage"><Users /></Guard>} />
        <Route path="/audit" element={<Guard perm="audit:read"><Audit /></Guard>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
