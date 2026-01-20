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

const Layout = () => {
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      <Sidebar onAIBuilderClick={() => setAiPanelOpen(!aiPanelOpen)} aiPanelOpen={aiPanelOpen} />
      <main className="flex-1 h-full overflow-hidden relative">
        <Outlet />
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
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
