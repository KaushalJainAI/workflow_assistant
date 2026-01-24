import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Sidebar from './components/layout/Sidebar';
import WorkflowsDashboard from './pages/WorkflowsDashboard';
import WorkflowEditor from './pages/WorkflowEditor';
import Executions from './pages/Executions';
import Credentials from './pages/Credentials';
import Settings from './pages/Settings';
import Documents from './pages/Documents';

import AIChat from './pages/AIChat';
import Login from './pages/Login';
import Signup from './pages/Signup';
import GoogleCallback from './pages/GoogleCallback';
import Billing from './pages/Billing';
import Insights from './pages/Insights';
import Orchestrator from './pages/Orchestrator';
import Profile from './pages/Profile';
import { ToastContainer } from './components/ui/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';

// Protected route wrapper
function ProtectedRoute({ children }: { children?: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

// Layout with sidebar
const Layout = () => {
  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 h-full overflow-hidden relative">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/auth/google/callback" element={<GoogleCallback />} />
            
            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Navigate to="/workflows" replace />} />
                <Route path="/workflows" element={<WorkflowsDashboard />} />
                <Route path="/workflow/:id" element={<WorkflowEditor />} />
                <Route path="/workflows/new" element={<WorkflowEditor />} />
                <Route path="/ai-chat" element={<AIChat />} />
                <Route path="/executions" element={<Executions />} />
                <Route path="/documents" element={<Documents />} />
                <Route path="/credentials" element={<Credentials />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/billing" element={<Billing />} />
                <Route path="/insights" element={<Insights />} />
                <Route path="/orchestrator" element={<Orchestrator />} />
                <Route path="/profile" element={<Profile />} />
              </Route>
            </Route>
          </Routes>
        </Router>
        <ToastContainer />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
