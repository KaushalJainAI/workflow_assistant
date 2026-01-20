# Nexus Project Documentation

Welcome to the **Nexus (Better n8n)** project! This documentation provides a comprehensive overview of the project structure and architectural components of this modern n8n clone frontend.

## Project Overview

Nexus is a React-based visual workflow editor inspired by n8n. It leverages **ReactFlow** for the canvas experience, **TailwindCSS** for styling, and **Zustand** for state management. It also features unique AI-powered workflow building capabilities.

## Source Code Structure (`src/`)

The `src/` directory is organized into logical modules:

### 📂 `components/`
Reusable UI components categorized by function:
- **`layout/`**: Core application structure including `Sidebar.tsx` and `AIChatPanel.tsx`.
- **`workflow/`**: Components specific to the workflow editor, such as `NodeConfigPanel.tsx`, `NodePanel.tsx`, and `GenericNode.tsx`.
- **`execution/`**: Components for visualizing execution data, including `TableView.tsx` and `ExecutionControls.tsx`.

### 📂 `pages/`
The main application views (routes):
- `WorkflowEditor.tsx`: The primary canvas for building and editing workflows.
- `WorkflowsDashboard.tsx`: List of all saved workflows.
- `Executions.tsx`: View of workflow run history.
- `Credentials.tsx`: Management of API keys and authentication.
- `Settings.tsx`: User preferences and theme management.
- `AIChat.tsx` & `Documents.tsx`: Unique AI-driven features.

### 📂 `hooks/`
Custom React hooks for global functionality:
- `useKeyboardShortcuts.ts`: Manages application-wide hotkeys (e.g., Save, Execute).
- `useTheme.ts`: Handles dark/light mode switching.
- `useUndoRedo.ts`: Implements the undo/redo stack for node/edge changes.

### 📂 `lib/`
Configuration and logic for workflow nodes:
- `nodeConfigs.ts`: Definitions for all available node types, including parameters and icons.
- `nodeRegistry.ts`: Logic for mapping node types to their visual components.
- `utils.ts`: Miscellaneous utility functions.

### 📂 `stores/`
State management logic:
- `useGraphStore.ts`: The central Zustand store managing nodes, edges, and workflow metadata.

### 📂 `nodes/`
Custom ReactFlow node implementations:
- `definitions/`: Individual node logic (e.g., `manualTrigger.ts`).

### 📂 `types/`
TypeScript interface and type definitions:
- `node.ts`: Types for node data and properties.

---

## Architecture & Data Flow

1.  **State Management**: `useGraphStore` acts as the single source of truth for the workflow graph. Changes in the editor (moving nodes, adding edges) are persisted in this store.
2.  **Workflow Editing**: `WorkflowEditor.tsx` renders the ReactFlow canvas, utilizing `GenericNode.tsx` for visual representation and `NodeConfigPanel.tsx` for parameter editing.
3.  **Extensibility**: Adding a new node type involves defining its configuration in `nodeConfigs.ts` and ensuring it is registered in `nodeRegistry.ts`.

## Tech Stack

- **Framework**: React 19 + Vite
- **Language**: TypeScript
- **Flow Engine**: ReactFlow
- **Styling**: TailwindCSS + Lucide Icons
- **State**: Zustand
- **Formatting**: ESLint + Prettier
