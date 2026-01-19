# Frontend Improvements for better-n8n (Nexus) Clone

This document outlines the frontend-only changes required to bring the better-n8n clone (Nexus) closer to feature parity with the official n8n frontend.

## Current State Summary

Your Nexus clone has solid foundations:
- ✅ Modern React 19 + TypeScript + Vite stack
- ✅ Clean TailwindCSS styling with dark theme support
- ✅ ReactFlow-based visual workflow editor
- ✅ Well-structured pages: Workflows, Executions, Credentials, Settings, Documents, AI Chat
- ✅ **Unique feature**: Built-in AI Workflow Builder (not in official n8n)

---

## 🔴 Critical Missing Features (High Priority)

### 1. Node Configuration Panel

**Current State:** Clicking a node only shows "Selected: [name]" with delete/settings buttons that do nothing.

**Required Changes:**
- [ ] Create `NodeConfigPanel.tsx` - a slide-out panel that appears when a node is selected
- [ ] Show node-specific configuration fields (based on node type)
- [ ] Input/output data preview tabs
- [ ] Expression editor support for dynamic values
- [ ] Parameter validation with error states

**Files to create:**
- `src/components/workflow/NodeConfigPanel.tsx`
- `src/components/workflow/ExpressionEditor.tsx`

---

### 2. Node Input/Output Handles (Multiple Connections)

**Current State:** Each node has only 1 input and 1 output handle.

**Required Changes:**
- [ ] Support multiple output handles for branching nodes (IF, Switch)
- [ ] Visual distinction between "success" and "error" output paths
- [ ] Labeled handles for clarity

**Files to modify:**
- `src/pages/WorkflowEditor.tsx` - Update node components

---

### 3. Execution Data Viewer

**Current State:** Executions page shows logs but no actual data flow visualization.

**Required Changes:**
- [ ] Show input/output data for each node in execution
- [ ] JSON tree viewer for data inspection
- [ ] Ability to copy data or use as test input
- [ ] "Pin" data feature to use as mock input during testing

**Files to create:**
- `src/components/execution/DataViewer.tsx`
- `src/components/execution/JsonTree.tsx`

**Files to modify:**
- `src/pages/Executions.tsx`

---

### 4. Workflow Test Mode

**Current State:** "Test" button exists but does nothing.

**Required Changes:**
- [ ] Execute workflow step-by-step with data preview
- [ ] Show execution progress on canvas (highlight active node)
- [ ] Display node outputs inline on the canvas
- [ ] Error highlighting with jump-to-node

**Files to modify:**
- `src/pages/WorkflowEditor.tsx`

---

## 🟡 Important Missing Features (Medium Priority)

### 5. More Node Types (20 → 400+)

**Current State:** Only ~20 node types defined in `NodePanel.tsx`.

**Required Changes:**
Expand the node library with categories:

| Category | Examples to Add |
|----------|-----------------|
| **AI** | Anthropic, OpenAI Assistant, AI Agent, Vector Stores |
| **Marketing** | Mailchimp, HubSpot, ActiveCampaign |
| **CRM** | Salesforce, Pipedrive, Zoho |
| **DevOps** | GitHub, GitLab, Docker, Kubernetes |
| **Cloud** | AWS S3, GCP, Azure |
| **Communication** | Telegram, Discord, Twilio, WhatsApp |
| **Files** | Google Drive, Dropbox, OneDrive |
| **Utilities** | Wait, Loop, Error Handling, Sub-workflow |

**Files to modify:**
- `src/components/workflow/NodePanel.tsx` - Add node definitions

---

### 6. Drag & Drop from Node Panel

**Current State:** Clicking nodes adds them at random positions.

**Required Changes:**
- [ ] Enable drag from NodePanel directly onto canvas
- [ ] Show drop indicator/preview while dragging
- [ ] Auto-connect to nearest compatible node

**Files to modify:**
- `src/pages/WorkflowEditor.tsx`
- `src/components/workflow/NodePanel.tsx`

---

### 7. Keyboard Shortcuts

**Current State:** No keyboard shortcuts implemented.

**Required Changes:**
Add shortcuts for common actions:

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save workflow |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Delete` | Delete selected node |
| `Ctrl+D` | Duplicate node |
| `Ctrl+C/V` | Copy/paste nodes |
| `Space` | Pan canvas |
| `+/-` | Zoom in/out |
| `Ctrl+Enter` | Execute workflow |

**Files to create:**
- `src/hooks/useKeyboardShortcuts.ts`

---

### 8. Undo/Redo Functionality

**Current State:** Undo/Redo buttons exist but don't work.

**Required Changes:**
- [ ] Implement action history stack
- [ ] Track node add/delete/move operations
- [ ] Track edge add/delete operations
- [ ] Visual feedback on undo/redo

**Files to create:**
- `src/hooks/useUndoRedo.ts`

---

### 9. Code Editor for Function Nodes

**Current State:** No code editing capability.

**Required Changes:**
- [ ] Integrate Monaco Editor or CodeMirror
- [ ] Syntax highlighting for JavaScript/Python
- [ ] Autocomplete for n8n helper functions
- [ ] Error linting

**Files to create:**
- `src/components/workflow/CodeEditor.tsx`

**Dependencies to add:**
```json
"@monaco-editor/react": "^4.6.0"
// OR
"@uiw/react-codemirror": "^4.21.0"
```

---

### 10. Workflow Version History

**Current State:** No version control.

**Required Changes:**
- [ ] Save workflow versions on each save
- [ ] Version comparison (diff view)
- [ ] Restore previous versions
- [ ] Show change history in sidebar

**Files to create:**
- `src/components/workflow/VersionHistory.tsx`

---

## 🟢 Nice-to-Have Features (Lower Priority)

### 11. Node Grouping / Sticky Notes

- [ ] Group related nodes visually
- [ ] Add sticky notes for documentation
- [ ] Collapse/expand groups

### 12. Workflow Import/Export

- [ ] Export workflow as JSON
- [ ] Import workflow from JSON
- [ ] Import from n8n format

### 13. Template Gallery

- [ ] Browse pre-built workflow templates
- [ ] One-click template import
- [ ] Community templates

### 14. Real-time Collaboration

- [ ] Multiple users editing same workflow
- [ ] Presence indicators
- [ ] Conflict resolution

### 15. Mobile Responsive Editor

- [ ] Touch-friendly node manipulation
- [ ] Responsive toolbar

---

## 🎨 UI/UX Improvements

### 16. Canvas Improvements

- [ ] **Grid snap toggle** - Already has snap, but no toggle
- [ ] **Zoom to fit** button
- [ ] **Center workflow** button
- [ ] **Node alignment tools** (align left, right, center, distribute)
- [ ] **Connection lines style options** (bezier, step, straight)

### 17. Empty States

- [ ] Better empty state for workflow canvas with quick-start tips
- [ ] Onboarding tutorial for first-time users

### 18. Loading States

- [ ] Skeleton loaders for workflow list
- [ ] Loading indicators for API calls

### 19. Dark Mode Toggle

**Current State:** Theme selector exists in Settings but doesn't actually apply.

**Required Changes:**
- [ ] Implement actual theme switching using CSS variables or Tailwind dark mode
- [ ] Persist theme preference in localStorage

---

## 📂 Current File Structure

```
src/
├── App.tsx                    ✅ Good routing setup
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx        ✅ Good - collapsible
│   │   └── AIChatPanel.tsx    ✅ Unique feature
│   └── workflow/
│       └── NodePanel.tsx      ⚠️ Needs more nodes
├── pages/
│   ├── WorkflowsDashboard.tsx ✅ Good list view
│   ├── WorkflowEditor.tsx     ⚠️ Needs config panel
│   ├── Executions.tsx         ⚠️ Needs data viewer
│   ├── Credentials.tsx        ✅ Well implemented
│   ├── Settings.tsx           ⚠️ Theme not working
│   ├── Documents.tsx          ✅ Unique feature
│   └── AIChat.tsx             ✅ Unique feature
└── hooks/                     📁 Empty - needs hooks
```

---

## Recommended Implementation Order

1. **Node Configuration Panel** - Core functionality
2. **Execution Data Viewer** - Essential for debugging
3. **Working Test Mode** - Makes workflows testable
4. **Keyboard Shortcuts** - Developer productivity
5. **Undo/Redo** - Expected functionality
6. **More Node Types** - Expands capabilities
7. **Code Editor** - Required for Function nodes
8. **Drag & Drop** - Better UX
9. **Theme Toggle** - Fix existing feature
10. **Everything else** - Based on priority

---

## Summary

Your Nexus clone has excellent foundations and some unique features (AI Builder, Documents) that the official n8n doesn't have. The main gaps are in the workflow editor experience:

| Area | Status |
|------|--------|
| **UI Design** | ✅ Excellent - modern and clean |
| **Page Structure** | ✅ Complete |
| **Node Library** | ⚠️ Basic (~20 nodes) |
| **Editor Features** | ⚠️ Missing critical features |
| **Execution View** | ⚠️ Logs only, no data |
| **Unique Features** | ✅ AI Builder is great |

Focus on the workflow editor improvements first, as that's where users will spend most of their time.
