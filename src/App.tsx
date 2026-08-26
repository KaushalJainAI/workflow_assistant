import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ThemeProvider, useThemeContext } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Sidebar from './components/layout/Sidebar';
import { useHITLReminders } from './hooks/useHITLReminders';

import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import Signup from './pages/Signup';
import GoogleCallback from './pages/GoogleCallback';

import { Toaster } from 'sonner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AssistantProvider } from './contexts/AssistantContext';
import RouteTransition from './components/layout/RouteTransition';
import { AppLoader } from './components/ui/Loading';

// Route-level code splitting.
//
// Everything below is reached by navigation, not by first paint, and some of
// it is expensive: the chat surfaces pull in the markdown stack. Loaded
// eagerly they all landed in one bundle behind a login screen that needs none
// of them. The auth pages stay static imports because they *are* the first
// paint.
const lazyPage = <T extends { default: React.ComponentType<any> }>(
  load: () => Promise<T>,
) => lazy(load);

const AIChat = lazyPage(() => import('./pages/AIChat'));
const AgentBuilder = lazyPage(() => import('./pages/AgentBuilder'));
const Agents = lazyPage(() => import('./pages/Agents'));
const Connections = lazyPage(() => import('./pages/Connections'));
const Credentials = lazyPage(() => import('./pages/Credentials'));
const Documents = lazyPage(() => import('./pages/Documents'));
const Imagine = lazyPage(() => import('./pages/Imagine'));
const Inbox = lazyPage(() => import('./pages/Inbox'));
const OAuthCallback = lazyPage(() => import('./pages/OAuthCallback'));
const Overview = lazyPage(() => import('./pages/Overview'));
const Profile = lazyPage(() => import('./pages/Profile'));
const Runs = lazyPage(() => import('./pages/Runs'));
const Schedules = lazyPage(() => import('./pages/Schedules'));
const Settings = lazyPage(() => import('./pages/Settings'));
const Skills = lazyPage(() => import('./pages/Skills'));

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

// Layout with sidebar
const Layout = () => {
  const { isAuthenticated } = useAuth();

  // One per-user HITL socket for the whole authenticated shell: raises OS
  // notifications for escalation/hourly/digest nudges and keeps the ['hitl']
  // cache (Sidebar badge, Inbox, Overview) fresh.
  useHITLReminders(isAuthenticated);

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
        </main>
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
        <Suspense fallback={<AppLoader />}>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/auth/google/callback" element={<GoogleCallback />} />

          {/* Landing — guests get a dedicated minimal page; authed users go to /ai-chat */}
          <Route path="/" element={<LandingRoute />} />

          {/* Credential OAuth popup. Protected because it completes the exchange
              as the signed-in user, but deliberately outside <Layout /> — it is a
              600px window that reports back to its opener and closes. Distinct
              from /auth/google/callback, which logs a user in. */}
          <Route element={<ProtectedRoute />}>
            <Route path="/oauth/callback" element={<OAuthCallback />} />
          </Route>

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/ai-chat" element={<AIChat />} />
              {/* The workflow *list* is retired: automations are listed on
                  /agents, and a workflow canvas is opened from an agent, a
                  template or a run — never browsed as its own catalogue. The
                  editor routes stay so every existing deep link still opens. */}
              <Route path="/workflows" element={<Navigate to="/agents" replace />} />
              {/* The DAG editor is gone (AGENT_BLOCKS_PLAN.md §6). Old links land on agents. */}
              <Route path="/workflow/:id" element={<Navigate to="/agents" replace />} />
              <Route path="/workflows/new" element={<Navigate to="/agents" replace />} />
              <Route path="/documents" element={<Documents />} />
              {/* Connections merges the former "Data sources" (/connectors) and
                  "Tools" (/mcp-servers), which were two views of the same two
                  tables. Both paths redirect so existing links keep working. */}
              <Route path="/connections" element={<Connections />} />
              <Route path="/connectors" element={<Navigate to="/connections" replace />} />
              <Route path="/mcp-servers" element={<Navigate to="/connections" replace />} />
              <Route path="/credentials" element={<Credentials />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/billing" element={<Navigate to="/settings" replace />} />
              <Route path="/insights" element={<Navigate to="/settings" replace />} />
              <Route path="/overview" element={<Overview />} />
              {/* The live monitor is superseded by Overview (broad posture),
                  Inbox (what needs you) and Runs (what happened). */}
              <Route path="/orchestrator" element={<Navigate to="/overview" replace />} />
              <Route path="/skills" element={<Skills />} />
              <Route path="/imagine" element={<Imagine />} />
              <Route path="/profile" element={<Profile />} />
              {/* Work */}
              <Route path="/inbox" element={<Inbox />} />
              <Route path="/runs" element={<Runs />} />
              <Route path="/schedules" element={<Schedules />} />
              {/* Build */}
              <Route path="/agents" element={<Agents />} />
              <Route path="/agents/new" element={<AgentBuilder />} />
              <Route path="/agents/:id" element={<AgentBuilder />} />
              {/* The agent canvas was retired 2026-08-24: a run is read on
                  /runs and in the Inbox, not projected onto a graph. */}
              <Route path="/agents/:id/canvas" element={<Navigate to="/agents" replace />} />
              {/* Extraction lives inside Documents now (schema admin) and Inbox
                  (the review queue); /extract routes were removed 2026-08-18. */}
              <Route path="/extract/*" element={<Navigate to="/documents" replace />} />
              {/* Runs replaced the old dead-end redirect. */}
              <Route path="/executions" element={<Navigate to="/runs" replace />} />
            </Route>
          </Route>
        </Routes>
        </Suspense>
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
