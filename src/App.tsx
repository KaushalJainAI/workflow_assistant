import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ThemeProvider, useThemeContext } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Sidebar from './components/layout/Sidebar';
import WorkflowsDashboard from './pages/WorkflowsDashboard';
import WorkflowEditor from './pages/WorkflowEditor';
import Credentials from './pages/Credentials';
import Settings from './pages/Settings';
import Documents from './pages/Documents';
import MCPServers from './pages/MCPServers';
import Connectors from './pages/Connectors';
import Profile from './pages/Profile';

import AIChat from './pages/AIChat';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import Signup from './pages/Signup';
import GoogleCallback from './pages/GoogleCallback';
import Orchestrator from './pages/Orchestrator';
import Templates from './pages/Templates';
import Skills from './pages/Skills';
import Imagine from './pages/Imagine';
import TemplateDetail from './pages/templates/TemplateDetail';
import Inbox from './pages/Inbox';
import Runs from './pages/Runs';
import Agents from './pages/Agents';
import AgentBuilder from './pages/AgentBuilder';
import Extract from './pages/Extract';
import ExtractionSchemaDetail from './pages/ExtractionSchemaDetail';
import Evals from './pages/Evals';
import EvalSuiteDetail from './pages/EvalSuiteDetail';
import Datasets from './pages/Datasets';
import DatasetDetail from './pages/DatasetDetail';
import Tuning from './pages/Tuning';
import TuningJobDetail from './pages/TuningJobDetail';
import { Toaster } from 'sonner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AssistantProvider, useAssistant } from './contexts/AssistantContext';
import GlobalAssistantPanel from './components/layout/GlobalAssistantPanel';
import RouteTransition from './components/layout/RouteTransition';
import { AppLoader } from './components/ui/Loading';
import { Sparkles } from 'lucide-react';

// Protected route wrapper
function ProtectedRoute({ children }: { children?: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <AppLoader label="Checking your session" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

import { useCanvasAgent } from './hooks/useCanvasAgent';
import { CanvasAgentProvider } from './contexts/CanvasAgentContext';

function GlobalCanvasAgentWrapper({ children }: { children: React.ReactNode }) {
  const canvasAgent = useCanvasAgent();
  return (
    <CanvasAgentProvider value={{ sendInstruction: canvasAgent.sendInstruction, isConnected: canvasAgent.isConnected, isProcessing: canvasAgent.isProcessing }}>
      {children}
    </CanvasAgentProvider>
  );
}

// Layout with sidebar
const Layout = () => {
  const { toggleAssistant, isAssistantOpen } = useAssistant();
  const { isAuthenticated } = useAuth();

  return (
    <div className="flex h-viewport w-full bg-background text-foreground overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex h-full overflow-hidden relative">
        <main className="flex-1 h-full overflow-hidden relative">
          <ErrorBoundary>
            <RouteTransition>
              <Outlet />
            </RouteTransition>
          </ErrorBoundary>

          {/* Global Help Button — only for authenticated users (the assistant hits authed endpoints) */}
          {isAuthenticated && (
            <div className="hidden md:block fixed bottom-4 right-8 z-[110]">
              <button
                onClick={toggleAssistant}
                className={`flex items-center gap-2 p-3 px-5 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-300 border backdrop-blur-md active:scale-95 ${
                  isAssistantOpen
                    ? 'bg-primary text-primary-foreground border-primary scale-110 shadow-primary/20'
                    : 'bg-card/40 text-muted-foreground border-border/50 hover:border-primary/50 hover:text-primary hover:shadow-primary/10 hover:bg-card/60'
                }`}
              >
                <Sparkles className={`w-5 h-5 ${isAssistantOpen ? 'animate-pulse' : ''}`} />
                <span className="text-sm font-bold tracking-tight">Help</span>
              </button>
            </div>
          )}
        </main>

        {isAuthenticated && <GlobalAssistantPanel />}
      </div>
    </div>
  );
};

// Renders the polished StandaloneChat UI on the public landing path.
// - Authenticated visitors are forwarded to /ai-chat (full Layout with canvas-agent etc.)
// - Guests get the same StandaloneChat UI wrapped in a minimal public shell
//   (sidebar visible; auth-only nav items show "Log in" toasts on click).
const LandingRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return <AppLoader label="Checking your session" />;
  }
  if (isAuthenticated) return <Navigate to="/ai-chat" replace />;
  return (
    <div className="flex h-viewport w-full bg-background text-foreground overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex h-full overflow-hidden relative">
        <main className="flex-1 h-full overflow-hidden relative">
          <ErrorBoundary>
            <AIChat />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};

const AppContent = () => {
  const { resolvedTheme } = useThemeContext();
  
  return (
    <>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/auth/google/callback" element={<GoogleCallback />} />

          {/* Landing — guests get a dedicated minimal page; authed users go to /ai-chat */}
          <Route path="/" element={<LandingRoute />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<GlobalCanvasAgentWrapper><Layout /></GlobalCanvasAgentWrapper>}>
              <Route path="/ai-chat" element={<AIChat />} />
              <Route path="/workflows" element={<WorkflowsDashboard />} />
              <Route path="/workflow/:id" element={<WorkflowEditor />} />
              <Route path="/workflows/new" element={<WorkflowEditor />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="/templates/:id" element={<TemplateDetail />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/connectors" element={<Connectors />} />
              <Route path="/mcp-servers" element={<MCPServers />} />
              <Route path="/credentials" element={<Credentials />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/billing" element={<Navigate to="/settings" replace />} />
              <Route path="/insights" element={<Navigate to="/settings" replace />} />
              <Route path="/orchestrator" element={<Orchestrator />} />
              <Route path="/skills" element={<Skills />} />
              <Route path="/imagine" element={<Imagine />} />
              <Route path="/profile" element={<Profile />} />
              {/* Work */}
              <Route path="/inbox" element={<Inbox />} />
              <Route path="/runs" element={<Runs />} />
              {/* Build */}
              <Route path="/agents" element={<Agents />} />
              <Route path="/agents/new" element={<AgentBuilder />} />
              <Route path="/agents/:id" element={<AgentBuilder />} />
              <Route path="/extract" element={<Extract />} />
              <Route path="/extract/:id" element={<ExtractionSchemaDetail />} />
              {/* Improve: corrections become datasets, datasets grade agents
                  and tune models. Each list has a detail page because the rows
                  are the point and there are too many to inline. */}
              <Route path="/evals" element={<Evals />} />
              <Route path="/evals/:id" element={<EvalSuiteDetail />} />
              <Route path="/datasets" element={<Datasets />} />
              <Route path="/datasets/:id" element={<DatasetDetail />} />
              <Route path="/tuning" element={<Tuning />} />
              <Route path="/tuning/:id" element={<TuningJobDetail />} />
              {/* Runs replaced the old dead-end redirect. */}
              <Route path="/executions" element={<Navigate to="/runs" replace />} />
            </Route>
          </Route>
        </Routes>
      </Router>
      <Toaster richColors position="bottom-left" theme={resolvedTheme} duration={1500} />
    </>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AssistantProvider>
          <AppContent />
        </AssistantProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
