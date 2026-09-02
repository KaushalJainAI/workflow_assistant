/**
 * Evaluation — suites of cases run against an agent, and the human review of
 * what the graders decided.
 *
 * The backend has had this surface since the eval app landed and nothing in
 * this app ever called it, so the whole feature was unreachable from the UI.
 *
 * One shape is worth knowing before reading the page: a run's score is
 * *provisional* until a person has answered the results queued for review.
 * `passed` is `null` while `status` is `awaiting_review`, and that is a real
 * state rather than a missing value — the page renders it as "awaiting review"
 * rather than as a failure or a blank.
 */
import apiClient from './client';

export type SupervisionPolicy = 'none' | 'disagreement' | 'sample' | 'all';

export type RunStatus =
  | 'queued' | 'running' | 'awaiting_review' | 'completed' | 'failed' | 'cancelled';

export interface GraderSpec {
  type: string;
  [key: string]: unknown;
}

export interface GraderCatalogEntry {
  type: string;
  label?: string;
  description?: string;
  params?: Record<string, unknown>;
}

export interface EvalCase {
  id: number;
  suite: number;
  name: string;
  order: number;
  goal: string;
  input_data: Record<string, unknown>;
  reference: string;
  graders: GraderSpec[];
  weight: number;
  tags: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LastRun {
  run_id: string;
  status: RunStatus;
  score: number | null;
  passed: boolean | null;
  pending_review: number;
  created_at: string;
}

export interface EvalSuite {
  id: number;
  name: string;
  slug: string;
  description: string;
  subagent: number | null;
  pass_threshold: number;
  supervision: SupervisionPolicy;
  sample_percent: number;
  reviewer: number | null;
  concurrency: number;
  tags: string[];
  is_active: boolean;
  case_count: number;
  last_run: LastRun | null;
  created_at: string;
  updated_at: string;
}

export interface SuiteDetail extends EvalSuite {
  cases: EvalCase[];
}

export interface EvalRun {
  run_id: string;
  suite: number;
  suite_name: string;
  subagent: number | null;
  agent_name: string;
  revision: number | null;
  revision_number: number | null;
  status: RunStatus;
  supervision: SupervisionPolicy;
  total_cases: number;
  passed_count: number;
  failed_count: number;
  error_count: number;
  pending_review_count: number;
  score: number | null;
  /** null while `status` is `awaiting_review` — provisional, not missing. */
  passed: boolean | null;
  /** How often a human agreed with the graders. The number that matters. */
  grader_agreement: number | null;
  tokens_used: number;
  duration_ms: number | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string;
  notes: string;
  created_at: string;
}

/**
 * A reviewer's answer. `unsure` is a real third option, not a missing one:
 * the point of the review model is measuring how often people agree with the
 * graders, and forcing a coin-flip when the reviewer genuinely cannot tell
 * would corrupt exactly the number the feature exists to produce.
 */
export type Verdict = 'pass' | 'fail' | 'unsure';

export interface EvalReview {
  id: number;
  verdict: Verdict;
  /** Whether this verdict matched `auto_passed`. Feeds `grader_agreement`. */
  agreed_with_graders: boolean | null;
  comment: string;
  corrected_answer: string;
  reviewer: number | null;
  reviewer_name: string;
  created_at: string;
  updated_at: string;
}

export interface EvalResult {
  id: number;
  run: string;
  case: number | null;
  case_name: string;
  goal: string;
  status: string;
  answer: string;
  answer_truncated: boolean;
  /** The graders' answer, kept for ever so agreement stays computable. */
  auto_passed: boolean | null;
  auto_score: number | null;
  grades: unknown;
  weight: number;
  review_state: string;
  review_reason: string;
  review: EvalReview | null;
  /** The review's verdict when there is one, else the graders'. */
  final_passed: boolean | null;
  final_score: number;
  tokens: number;
  duration_ms: number | null;
  error_message: string;
  /** Feeds `/api/logs/executions/{id}/` — score straight to full trace. */
  execution_id: string | null;
  created_at: string;
}

export interface QueueItem extends EvalResult {
  suite_id: number;
  suite_name: string;
  run_id: string;
}

/** `health` is the backend's own summary; shape is left open deliberately. */
export interface SuiteListResponse {
  suites: EvalSuite[];
  health: unknown;
}

const evalsService = {
  listSuites: async (): Promise<SuiteListResponse> => {
    const { data } = await apiClient.get<SuiteListResponse>('/eval/suites/');
    return { suites: data?.suites ?? [], health: data?.health ?? null };
  },

  createSuite: async (body: Partial<EvalSuite>): Promise<EvalSuite> => {
    const { data } = await apiClient.post<EvalSuite>('/eval/suites/', body);
    return data;
  },

  getSuite: async (id: number): Promise<SuiteDetail> => {
    const { data } = await apiClient.get<SuiteDetail>(`/eval/suites/${id}/`);
    return { ...data, cases: data?.cases ?? [] };
  },

  updateSuite: async (id: number, body: Partial<EvalSuite>): Promise<EvalSuite> => {
    const { data } = await apiClient.patch<EvalSuite>(`/eval/suites/${id}/`, body);
    return data;
  },

  deleteSuite: async (id: number): Promise<void> => {
    await apiClient.delete(`/eval/suites/${id}/`);
  },

  createCase: async (suiteId: number, body: Partial<EvalCase>): Promise<EvalCase> => {
    const { data } = await apiClient.post<EvalCase>(`/eval/suites/${suiteId}/cases/`, body);
    return data;
  },

  updateCase: async (caseId: number, body: Partial<EvalCase>): Promise<EvalCase> => {
    const { data } = await apiClient.patch<EvalCase>(`/eval/cases/${caseId}/`, body);
    return data;
  },

  deleteCase: async (caseId: number): Promise<void> => {
    await apiClient.delete(`/eval/cases/${caseId}/`);
  },

  /** 202 + a run id — a sweep is one agent run per case, so it never blocks. */
  runSuite: async (
    suiteId: number,
    body: { agent_id?: number; notes?: string } = {},
  ): Promise<{ run_id: string; suite_id: number; agent_id: number }> => {
    const { data } = await apiClient.post(`/eval/suites/${suiteId}/run/`, body);
    return data;
  },

  listRuns: async (params: { suite_id?: number } = {}): Promise<EvalRun[]> => {
    const { data } = await apiClient.get<{ runs?: EvalRun[] }>('/eval/runs/', { params });
    return data?.runs ?? [];
  },

  getRun: async (runId: string): Promise<EvalRun & { results: EvalResult[] }> => {
    const { data } = await apiClient.get(`/eval/runs/${runId}/`);
    return { ...data, results: data?.results ?? [] };
  },

  cancelRun: async (runId: string): Promise<void> => {
    await apiClient.post(`/eval/runs/${runId}/cancel/`, {});
  },

  reviewQueue: async (params: { suite_id?: number; run_id?: string } = {}): Promise<QueueItem[]> => {
    const { data } = await apiClient.get<{ queue?: QueueItem[] }>('/eval/reviews/pending/', { params });
    return data?.queue ?? [];
  },

  /** The verdict overrides the graders without overwriting `auto_passed`. */
  submitReview: async (
    resultId: number,
    body: { verdict: Verdict; comment?: string; corrected_answer?: string },
  ): Promise<unknown> => {
    const { data } = await apiClient.post(`/eval/results/${resultId}/review/`, body);
    return data;
  },

  graderCatalog: async (): Promise<GraderCatalogEntry[]> => {
    const { data } = await apiClient.get<{ graders?: GraderCatalogEntry[] }>('/eval/graders/');
    return data?.graders ?? [];
  },

  scorecard: async (agentId: number): Promise<unknown> => {
    const { data } = await apiClient.get(`/eval/agents/${agentId}/scorecard/`);
    return data;
  },
};

export default evalsService;
