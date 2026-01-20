# ✨ Nexus Frontend Capabilities

This document provides a comprehensive list of all features and capabilities currently implemented in the **Nexus (Better n8n)** frontend.

## 🧠 Core Workflow Editor
The heart of the application, built with **ReactFlow**.

- **Visual Canvas**: Drag-and-drop interface with infinite panning and zooming.
- **Node Management**:
    - **Add Nodes**: Drag from the palette or use the `+` button on existing nodes.
    - **Connect Nodes**: intelligent edge routing with animated data flow indicators.
    - **Multi-Selection**: Select multiple nodes for bulk moving or deletion.
- **Node Configuration Panel**:
    - **Dynamic Properties**: Forms automatically generated based on node type.
    - **Expression Editor**: Support for dynamic JavaScript expressions `{{ $json.id }}`.
    - **Data Viewer**: Inspect input/output JSON data for each node.
- **Node Builder (New!)** 🛠️:
    - **Create Custom Types**: Define new node types from scratch.
    - **Schema Editor**: Visually build the input form (Text, Number, Select, Secrets, etc.).
    - **Code Definition**: Write the Python/JS execution logic directly in the browser.
    - **Custom Visuals**: Pick custom emojis and colors for your nodes.
- **Execution & Testing**:
    - **Test Run**: Execute the workflow and visualize data flow.
    - **Validation**: Real-time validation of connections and required fields.

## 🤖 AI Features
Integrated AI capabilities to accelerate workflow building.

- **AI Chat Assistant**: A sidebar assistant to answer questions about n8n or help debug.
- **AI Workflow Builder**: Describe your goal in plain English (e.g., "Scrape this site and email me"), and the AI generates the graph for you.

## 📊 Management & Dashboard
Tools to manage your automation infrastructure.

- **Workflows Dashboard**:
    - List view with status indicators (Active/Inactive).
    - Search and filter by tags or name.
- **Executions History**:
    - detailed log of past runs.
    - Filter by status (Success/Error) and date range.
    - **Logs View**: deep dive into system logs.
- **Insights Dashboard**:
    - Visual charts (bar/line) showing execution trends, credit usage, and success rates.

## 🔐 Credentials & Security
- **Credential Manager**: Securely store API keys, OAuth tokens, and database passwords.
- **RBAC**: (UI foundations) User roles and permissions structure.

## ⚙️ Utilities & DX (Developer Experience)
- **Theme Support**: Fully functioning **Dark/Light mode** toggles.
- **Keyboard Shortcuts**:
    - `Ctrl+S`: Save
    - `Ctrl+Z / Ctrl+Y`: Undo/Redo
    - `Delete`: Remove nodes
    - `Ctrl+Enter`: Execute
- **Undo/Redo Stack**: deeply integrated history management for canvas operations.
- **Import/Export**: detailed JSON import/export compatibility.

## 📝 Documentation
- **Integrated Docs**: `Documents` page for reading internal guides.
