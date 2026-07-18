import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom';
import { ReactNode } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import { ETLProvider } from './contexts/ETLContext';
import { KPIProvider } from './contexts/KPIContext';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import KPIs from './pages/KPIs';
import Logs from './pages/Logs';
import Settings from './pages/Settings';
import Parametros from './pages/Parametros';

function PrivateRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/kpis"
        element={
          <PrivateRoute>
            <KPIs />
          </PrivateRoute>
        }
      />
      <Route
        path="/logs"
        element={
          <PrivateRoute>
            <Logs />
          </PrivateRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <PrivateRoute>
            <Settings />
          </PrivateRoute>
        }
      />
      <Route
        path="/parametros"
        element={
          <PrivateRoute>
            <Parametros />
          </PrivateRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ETLProvider>
            <KPIProvider>
              <AppRoutes />
            </KPIProvider>
          </ETLProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
