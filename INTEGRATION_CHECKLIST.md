# Frontend-Backend Integration Checklist

This document maps all frontend pages, their components, and required backend API endpoints.

---

## 📍 Pages & Components Overview

### 🔐 Authentication Pages

#### Login.tsx
- **Components Used**: None (self-contained)
- **API Dependencies**:
  - [x] `POST /api/auth/login/` - User login
  - [x] `POST /api/auth/token/refresh/` - Token refresh
  - [x] `GET /api/auth/google/login/` - Google OAuth initiation
  - [ ] `POST /api/auth/forgot-password/` - Password reset ⚠️ **MISSING**

#### Signup.tsx
- **Components Used**: None (self-contained)
- **API Dependencies**:
  - [x] `POST /api/auth/register/` - User registration
  - [x] `GET /api/auth/google/login/` - Google OAuth initiation

#### GoogleCallback.tsx
- **Components Used**: None (redirect handler)
- **API Dependencies**:
  - [x] `GET /api/auth/google/callback/` - Google OAuth callback

---

### 📊 Dashboard Pages

#### WorkflowsDashboard.tsx
- **Components Used**: None (self-contained)
- **API Dependencies**:
  - [x] `GET /api/workflows/` - List workflows
  - [x] `POST /api/workflows/` - Create workflow
  - [x] `DELETE /api/workflows/{id}/` - Delete workflow
  - [x] `POST /api/workflows/{id}/duplicate/` - Duplicate workflow

---

### ✏️ Workflow Editor Page

#### WorkflowEditor.tsx
- **Components Used**:
  - `GenericNode` - Custom React Flow node renderer
  - `NodePanel` - Node selection sidebar
  - `NodeConfigPanel` - Node configuration editor
  - `VersionHistoryPanel` - Workflow version history
  - `WorkflowValidationPanel` - Real-time validation display
  - `WorkflowSettingsPanel` - Supervision level settings
  - `ExecutionOverlay` - Execution progress overlay
  - `CommandPalette` - Keyboard command palette
  - `ExportPanel` - Export workflow options
  - `ImportWorkflowModal` - Import workflow dialog
  - `TemplatesGallery` - Template selection
  - `NodeBuilderModal` - Custom node builder
  - `SaveCustomNodeModal` - Save custom node dialog
  - `CredentialPicker` - Credential selection
  - `ExpressionEditor` - Expression builder
  - `ApprovalModal` - HITL approval dialog
  - `ClarificationModal` - HITL clarification dialog
  - `AIChatPanel` - AI assistant integration
- **API Dependencies**:
  - [x] `GET /api/workflows/{id}/` - Load workflow
  - [x] `PATCH /api/workflows/{id}/` - Save workflow
  - [x] `POST /api/workflows/{id}/execute/` - Execute workflow
  - [x] `POST /api/workflows/{id}/deploy/` - Deploy workflow
  - [x] `GET /api/nodes/` - Get available nodes
  - [x] `GET /api/nodes/definitions/` - Get node definitions
  - [x] `GET /api/credentials/` - List credentials
  - [x] `GET /api/workflows/{id}/versions/` - Get version history
  - [x] `POST /api/workflows/{id}/versions/` - Create version
  - [x] `POST /api/workflows/{id}/versions/{v}/restore/` - Restore version
  - [x] `POST /api/custom-nodes/` - Create custom node
  - [x] `WS /ws/execution/{id}/` - Execution WebSocket
  - [x] `POST /api/chat/message/` - AI chat messages (streaming)

---

### 🤖 Orchestrator Page

#### Orchestrator.tsx
- **Components Used**:
  - `PendingApprovals` - Pending HITL requests list
  - `OrchestratorTimeline` - Execution timeline
  - `OrchestratorThoughts` - AI reasoning display
  - `ApprovalModal` - Approval dialog
  - `ClarificationModal` - Clarification dialog
  - `ErrorRecoveryModal` - Error recovery dialog
- **API Dependencies**:
  - [x] `GET /api/orchestrator/pending/` - Pending approvals
  - [x] `POST /api/orchestrator/respond/` - Submit response
  - [x] `GET /api/orchestrator/timeline/` - Get timeline
  - [x] `GET /api/orchestrator/thoughts/` - Get thoughts history
  - [x] `POST /api/orchestrator/config/` - Update LLM config (provider/model)
  - [x] `WS /ws/orchestrator/` - Orchestrator WebSocket

---

### 📄 Documents Page

#### Documents.tsx
- **Components Used**: None (self-contained)
- **API Dependencies**:
  - [x] `GET /api/documents/` - List documents
  - [x] `POST /api/documents/upload/` - Upload document
  - [x] `DELETE /api/documents/{id}/` - Delete document
  - [x] `GET /api/documents/{id}/download/` - Download document
  - [x] `POST /api/documents/{id}/share/` - Share document
  - [x] `POST /api/rag/search/` - RAG search

---

### 🔑 Credentials Page

#### Credentials.tsx
- **Components Used**:
  - `CredentialModal` - Create/edit credential dialog
- **API Dependencies**:
  - [x] `GET /api/credentials/` - List credentials
  - [x] `GET /api/credentials/types/` - Get credential types
  - [x] `POST /api/credentials/` - Create credential
  - [x] `PUT /api/credentials/{id}/` - Update credential
  - [x] `DELETE /api/credentials/{id}/` - Delete credential
  - [x] `POST /api/credentials/{id}/verify/` - Verify credential
  - [x] `POST /api/credentials/google/connect/` - Google OAuth connect

---

### 📋 Executions Page

#### Executions.tsx
- **Components Used**:
  - `DataViewer` - Execution data viewer
  - `JsonTree` - JSON tree display
  - `TableView` - Table data display
- **API Dependencies**:
  - [x] `GET /api/executions/` - List executions
  - [x] `GET /api/executions/{id}/` - Execution details
  - [x] `GET /api/executions/{id}/nodes/` - Node execution logs
  - [x] `POST /api/executions/{id}/stop/` - Stop execution
  - [x] `POST /api/executions/{id}/retry/` - Retry execution

---

### 📝 Logs Page

#### Logs.tsx
- **Components Used**: None (self-contained)
- **API Dependencies**:
  - [x] `GET /api/logs/` - List logs (with filters)
  - [x] `GET /api/logs/{id}/` - Log details
  - [ ] `GET /api/logs/export/` - Export logs (CSV/JSON) ⚠️ **MISSING**

---

### 👤 Profile Page

#### Profile.tsx
- **Components Used**: None (self-contained)
- **API Dependencies**:
  - [x] `GET /api/auth/profile/` - Get profile
  - [x] `PATCH /api/auth/profile/` - Update profile
  - [x] `POST /api/auth/change-password/` - Change password
  - [x] `GET /api/auth/api-key/` - Get API key
  - [x] `POST /api/auth/api-key/regenerate/` - Regenerate API key

---

### ⚙️ Settings Page

#### Settings.tsx
- **Components Used**: None (self-contained)
- **API Dependencies**:
  - [x] `GET /api/settings/` - Get settings
  - [x] `PATCH /api/settings/` - Update settings
  - [ ] `GET /api/settings/notifications/` - Get notification prefs ⚠️ **MISSING**
  - [ ] `PATCH /api/settings/notifications/` - Update notification prefs ⚠️ **MISSING**

---

### 💰 Billing Page

#### Billing.tsx
- **Components Used**:
  - `InsightsDashboard` - Usage insights & charts
- **API Dependencies**:
  - [ ] `GET /api/billing/usage/` - Current usage stats ⚠️ **MISSING**
  - [ ] `GET /api/billing/plan/` - Current plan info ⚠️ **MISSING**
  - [ ] `POST /api/billing/upgrade/` - Plan upgrade ⚠️ **MISSING**
  - [x] `GET /api/insights/stats/` - Execution statistics

---

### 📊 Insights Page

#### Insights.tsx
- **Components Used**:
  - `InsightsDashboard` - Full insights dashboard
- **API Dependencies**:
  - [x] `GET /api/insights/stats/` - Dashboard statistics
  - [x] `GET /api/insights/cost/` - Cost breakdown
  - [ ] `GET /api/insights/charts/` - Chart data ⚠️ **MISSING**

---

### 📚 Templates Page

#### Templates.tsx
- **Components Used**: None (self-contained)
- **API Dependencies**:
  - [x] `GET /api/templates/` - List templates
  - [x] `GET /api/templates/{id}/` - Template details
  - [x] `POST /api/templates/{id}/use/` - Use template
  - [x] `POST /api/workflows/{id}/save-as-template/` - Save as template

---

### 💬 AI Chat Page

#### AIChat.tsx
- **Components Used**:
  - `ChatPanel` - Full chat interface
- **API Dependencies**:
  - [x] `POST /api/chat/message/` - Send message (streaming)
  - [x] `GET /api/chat/history/` - Chat history
  - [x] `DELETE /api/chat/history/` - Clear history

---

### 🎨 Imagine Page

#### Imagine.tsx
- **Components Used**:
  - `MediaPreview` - Media previewer
- **API Dependencies**:
  - [ ] `POST /api/imagine/generate/` - Imagine generation (image/video/audio) ⚠️ **MISSING**
  - [ ] `GET /api/skills/search/` - Fetch skills (partially implemented)
  - [x] `GET /api/skills/search/?tab=mine` - Fetch user skills
  - [ ] `GET /api/imagine/history/` - Get generation history ⚠️ **MISSING**

---

## 🧩 Shared Components

### Layout Components
| Component | Used By | API Dependencies |
|-----------|---------|------------------|
| `Sidebar.tsx` | All pages | None (navigation only) |
| `AIChatPanel.tsx` | WorkflowEditor | `POST /api/chat/message/` |
| `ChatPanel.tsx` | AIChat, AIChatPanel | `POST /api/chat/message/`, `GET /api/chat/history/` |

### Modal Components
| Component | Used By | API Dependencies |
|-----------|---------|------------------|
| `ApprovalModal.tsx` | Orchestrator, WorkflowEditor | `POST /api/orchestrator/respond/` |
| `ClarificationModal.tsx` | Orchestrator, WorkflowEditor | `POST /api/orchestrator/respond/` |
| `ErrorRecoveryModal.tsx` | Orchestrator | `POST /api/orchestrator/respond/` |

### Workflow Components
| Component | Used By | API Dependencies |
|-----------|---------|------------------|
| `GenericNode.tsx` | WorkflowEditor | None (render only) |
| `NodePanel.tsx` | WorkflowEditor | `GET /api/nodes/` |
| `NodeConfigPanel.tsx` | WorkflowEditor | None (local state) |
| `VersionHistoryPanel.tsx` | WorkflowEditor | `GET /api/workflows/{id}/versions/` |
| `WorkflowValidationPanel.tsx` | WorkflowEditor | None (local validation) |
| `WorkflowSettingsPanel.tsx` | WorkflowEditor | None (local state) |
| `CommandPalette.tsx` | WorkflowEditor | None (local commands) |
| `ExportPanel.tsx` | WorkflowEditor | None (local export) |
| `ImportWorkflowModal.tsx` | WorkflowEditor | `POST /api/workflows/import/` |
| `TemplatesGallery.tsx` | WorkflowEditor | `GET /api/templates/` |
| `NodeBuilderModal.tsx` | WorkflowEditor | `POST /api/custom-nodes/` |
| `SaveCustomNodeModal.tsx` | WorkflowEditor | `POST /api/custom-nodes/` |
| `CredentialPicker.tsx` | WorkflowEditor | `GET /api/credentials/` |
| `ExpressionEditor.tsx` | WorkflowEditor | None (local state) |
| `ExecutionOverlay.tsx` | WorkflowEditor | `WS /ws/execution/{id}/` |

### Execution Components
| Component | Used By | API Dependencies |
|-----------|---------|------------------|
| `DataViewer.tsx` | Executions | None (display only) |
| `JsonTree.tsx` | Executions, DataViewer | None (display only) |
| `TableView.tsx` | Executions, DataViewer | None (display only) |

### Orchestrator Components
| Component | Used By | API Dependencies |
|-----------|---------|------------------|
| `OrchestratorThoughts.tsx` | Orchestrator | `GET /api/orchestrator/thoughts/` |
| `OrchestratorTimeline.tsx` | Orchestrator | `GET /api/orchestrator/timeline/` |
| `PendingApprovals.tsx` | Orchestrator | `GET /api/orchestrator/pending/` |

### UI Components
| Component | Used By | API Dependencies |
|-----------|---------|------------------|
| `EmptyState.tsx` | Multiple pages | None (display only) |
| `Skeleton.tsx` | Multiple pages | None (display only) |
| `Toast.tsx` | Global | None (notifications) |
| `ErrorBoundary.tsx` | App root | None (error handling) |

### Billing/Insights Components
| Component | Used By | API Dependencies |
|-----------|---------|------------------|
| `InsightsDashboard.tsx` | Billing, Insights | `GET /api/insights/stats/`, `GET /api/insights/cost/` |

### Credentials Components
| Component | Used By | API Dependencies |
|-----------|---------|------------------|
| `CredentialModal.tsx` | Credentials | `POST /api/credentials/`, `PUT /api/credentials/{id}/` |

---

## ⚠️ Missing Backend Endpoints Summary

| Endpoint | Page | Priority |
|----------|------|----------|
| `POST /api/imagine/generate/` | Imagine | High |
| `GET /api/imagine/history/` | Imagine | Medium |
| `POST /api/auth/forgot-password/` | Login | High |
| `GET /api/logs/export/` | Logs | Medium |
| `GET /api/settings/notifications/` | Settings | Medium |
| `PATCH /api/settings/notifications/` | Settings | Medium |
| `GET /api/billing/usage/` | Billing | Medium |
| `GET /api/billing/plan/` | Billing | Medium |
| `POST /api/billing/upgrade/` | Billing | Low |
| `GET /api/insights/charts/` | Insights | Medium |

---

## 📡 WebSocket Connections

| Endpoint | Used By | Purpose |
|----------|---------|---------|
| `WS /ws/execution/{id}/` | WorkflowEditor | Real-time execution updates |
| `WS /ws/orchestrator/` | Orchestrator | HITL requests & status updates |

---

## 📊 Summary

| Category | Pages | Components | API Endpoints |
|----------|-------|------------|---------------|
| Authentication | 3 | 0 | 4 (1 missing) |
| Dashboard | 1 | 0 | 4 |
| Workflow | 1 | 16 | 12 |
| Orchestrator | 1 | 6 | 6 |
| Documents | 1 | 0 | 6 |
| Credentials | 1 | 1 | 7 |
| Executions | 1 | 3 | 5 |
| Logs | 1 | 0 | 2 (1 missing) |
| Profile | 1 | 0 | 5 |
| Settings | 1 | 0 | 2 (2 missing) |
| Billing | 1 | 1 | 1 (3 missing) |
| Insights | 1 | 1 | 2 (1 missing) |
| Templates | 1 | 0 | 4 |
| AI Chat | 1 | 1 | 3 |
| Imagine | 1 | 1 | 4 (2 missing) |
| **Total** | **17** | **30** | **67 (10 missing)** |
