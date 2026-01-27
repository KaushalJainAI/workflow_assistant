# Frontend API Requirements

This document lists all the APIs required by the frontend application to support the complete UI functionality. It covers both existing endpoints and those that need to be implemented.

## 1. Authentication & User (`authService`)

| UI Action | Endpoint | Method | Working |
| :--- | :--- | :--- | :--- |
| **Login** | `/auth/login/` | `POST` | Validates email/password, returns `access` and `refresh` JWTs + user info. |
| **Register** | `/auth/register/` | `POST` | Creates new user account, returns tokens. |
| **Google SSO** | `/auth/google/` | `POST` | Exchanges OAuth2 code for tokens; handles account creation/linking. |
| **Token Refresh** | `/auth/token/refresh/` | `POST` | Rotates short-lived access token using refresh token. |
| **Get Profile** | `/auth/profile/` | `GET` | returns user details, tier, credits, and usage stats. |
| **Update Profile** | `/auth/profile/` | `PATCH` | Updates name, email, or local preferences (theme, language). |
| **Upload Avatar** | `/auth/profile/avatar/` | `POST` | *(Required)* Uploads and sets user profile picture. |
| **Change Password** | `/auth/profile/password/` | `POST` | *(Required)* Secure password change endpoint. |

## 2. API Keys & Security

| UI Action | Endpoint | Method | Working |
| :--- | :--- | :--- | :--- |
| **List API Keys** | `/auth/api-keys/` | `GET` | *(Required)* Lists active API keys (showing prefix/masked view). |
| **Create API Key** | `/auth/api-keys/` | `POST` | *(Required)* Generates a new long-lived API key. Shown once. |
| **Revoke API Key** | `/auth/api-keys/:id/` | `DELETE` | *(Required)* Invalidates a specific API key. |

## 3. Workflows (`workflowsService`)

| UI Action | Endpoint | Method | Working |
| :--- | :--- | :--- | :--- |
| **List Workflows** | `/orchestrator/workflows/` | `GET` | Lists workflows with status, last run time, and stats. Supports filtering. |
| **Create Workflow** | `/orchestrator/workflows/` | `POST` | Creates a new workflow (blank or from template). |
| **Get Workflow** | `/orchestrator/workflows/:id/` | `GET` | Fetches full graph (nodes, edges) and configuration for the editor. |
| **Update Workflow** | `/orchestrator/workflows/:id/` | `PUT` | Saves the current state of the workflow graph and settings. |
| **Delete Workflow** | `/orchestrator/workflows/:id/` | `DELETE` | Removes a workflow and its execution history. |
| **Clone Workflow** | `/orchestrator/workflows/:id/clone/` | `POST` | Creates a deep copy of a workflow. |
| **Export Workflow** | `/orchestrator/workflows/:id/export/` | `GET` | *(Required)* Downloads workflow JSON structure. |
| **Import Workflow** | `/orchestrator/workflows/import/` | `POST` | *(Required)* Uploads/Parses JSON to create a new workflow. |
| **Get Webhook URL** | `/orchestrator/workflows/:id/webhook/` | `GET` | *(Required)* Returns the production/test webhook URLs for this workflow. |
| **List Variables** | `/orchestrator/workflows/:id/variables/` | `GET` | *(Required)* Manage workflow-scoped variables/secrets. |

## 4. Version History

| UI Action | Endpoint | Method | Working |
| :--- | :--- | :--- | :--- |
| **List Versions** | `/orchestrator/workflows/:id/versions/` | `GET` | Returns list of saved versions (timestamp, user, summary). |
| **Create Snapshot** | `/orchestrator/workflows/:id/versions/` | `POST` | Manually creates a named version snapshot. |
| **Restore Version** | `/orchestrator/workflows/:id/versions/:vid/restore/` | `POST` | Reverts the active workflow to a specific version state. |

## 5. Orchestration & Execution (`orchestratorService`)

| UI Action | Endpoint | Method | Working |
| :--- | :--- | :--- | :--- |
| **Execute (Full)** | `/orchestrator/workflows/:id/execute/` | `POST` | Triggers asynchronous execution of the entire workflow. |
| **Execute (Partial)** | `/orchestrator/workflows/:id/execute/partial/` | `POST` | *(Required)* Executes specific nodes or sub-graph (for "Test Node"). Accepts `{ nodeIds: [] }`. |
| **Execution Status** | `/orchestrator/executions/:id/` | `GET` | Polls for status, active node, and progress. |
| **Control (Pause)** | `/orchestrator/executions/:id/pause/` | `POST` | Suspens execution state. |
| **Control (Resume)** | `/orchestrator/executions/:id/resume/` | `POST` | Resumes execution from valid suspended state. |
| **Control (Stop)** | `/orchestrator/executions/:id/stop/` | `POST` | Forcefully kills the execution process. |
| **Validation** | `/orchestrator/workflows/validate/` | `POST` | *(Required)* Server-side validation of graph integrity and configuration. |

## 6. Nodes & Registry (`nodeService`)

| UI Action | Endpoint | Method | Working |
| :--- | :--- | :--- | :--- |
| **List Types** | `/nodes/` | `GET` | Returns registry of all available node types and basics. |
| **Node Details** | `/nodes/:type/` | `GET` | detailed schema, inputs/outputs, and configuration options. |
| **Dynamic Options** | `/nodes/:type/options/:field/` | `POST` | *(Required)* Fetches dynamic dropdown options (e.g. list Slack channels) using credentials. |

## 7. Credentials (`credentialsService`)

| UI Action | Endpoint | Method | Working |
| :--- | :--- | :--- | :--- |
| **List Types** | `/credentials/types/` | `GET` | Returns metadata for credential types (fields, auth method). |
| **List Saved** | `/credentials/` | `GET` | Lists user's credentials (summary only, no secrets). |
| **Create** | `/credentials/` | `POST` | Encrypts and stores new credentials. |
| **Update** | `/credentials/:id/` | `PATCH` | Updates fields; re-encrypts changed values. |
| **OAuth Authorize** | `/credentials/oauth/:type/authorize/` | `GET` | *(Required)* Returns redirect URL for OAuth2 initiation. |
| **OAuth Callback** | `/credentials/oauth/callback/` | `POST` | *(Required)* Exchanges auth code for refresh/access tokens. |
| **Verify** | `/credentials/:id/verify/` | `POST` | Tests connectivity using the stored credentials. |

## 8. AI Assistant

| UI Action | Endpoint | Method | Working |
| :--- | :--- | :--- | :--- |
| **Generate Workflow**| `/orchestrator/ai/generate/` | `POST` | Text-to-workflow generation. |
| **Modify Workflow** | `/orchestrator/workflows/:id/ai/modify/` | `POST` | Apply natural language edits to graph. |
| **Chat** | `/orchestrator/chat/` | `POST` | Send message to assistant context. |
| **History** | `/orchestrator/chat/history/` | `GET` | Retrieve past conversation threads. |
| **Contextual Help** | `/orchestrator/chat/context/` | `POST` | Ask questions about specific selected nodes. |

## 9. Documents (RAG)

| UI Action | Endpoint | Method | Working |
| :--- | :--- | :--- | :--- |
| **List Docs** | `/inference/documents/` | `GET` | Manage knowledge base files. |
| **Upload** | `/inference/documents/` | `POST` | Upload, convert to text, chunk, and embed. |
| **Delete** | `/inference/documents/:id/` | `DELETE` | Remove file and associated vector embeddings. |
| **Search** | `/inference/rag/search/` | `POST` | Test vector search retrieval. |

## 10. Logs & Audit

| UI Action | Endpoint | Method | Working |
| :--- | :--- | :--- | :--- |
| **List Executions** | `/logs/executions/` | `GET` | Historical run data (status, time, trigger). |
| **Log Details** | `/logs/executions/:id/details/` | `GET` | Step-by-step logs, inputs/outputs per node. |
| **Audit Trail** | `/logs/audit/` | `GET` | Security logs (who accessed what). |
| **Stats** | `/logs/insights/stats/` | `GET` | Dashboard charts (success rate, daily executions). |

## 11. Templates

| UI Action | Endpoint | Method | Working |
| :--- | :--- | :--- | :--- |
| **List Templates** | `/orchestrator/templates/` | `GET` | Registry of public/system templates. |
| **Search** | `/orchestrator/templates/search/` | `POST` | Semantic search for templates. |
| **Install** | `/orchestrator/templates/:id/install/` | `POST` | Duplicates template to user workflow. |
