import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import Sidebar from './components/layout/Sidebar';
import AIChatPanel from './components/layout/AIChatPanel';
import WorkflowsDashboard from './pages/WorkflowsDashboard';
import WorkflowEditor from './pages/WorkflowEditor';
import Executions from './pages/Executions';
import Credentials from './pages/Credentials';
import Settings from './pages/Settings';
import Documents from './pages/Documents';

import AIChat from './pages/AIChat';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Billing from './pages/Billing';
import Insights from './pages/Insights';
import Orchestrator from './pages/Orchestrator';
import { ToastContainer } from './components/ui/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';

const Layout = () => {
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      <Sidebar onAIBuilderClick={() => setAiPanelOpen(!aiPanelOpen)} aiPanelOpen={aiPanelOpen} />
      <main className="flex-1 h-full overflow-hidden relative">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      <AIChatPanel isOpen={aiPanelOpen} onClose={() => setAiPanelOpen(false)} />
    </div>
  );
};

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          
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
          </Route>
        </Routes>
      </Router>
      <ToastContainer />
    </ThemeProvider>
  );
}

export default App;

