/**
 * Datasets, evals and tuning — the loop that makes an agent better.
 *
 * One module because they are one pipeline: a correction becomes a dataset row,
 * the dataset grades the agent in an eval suite, and the same rows tune a small
 * model to do the job cheaper. Splitting them across three files would hide that
 * they are the same data at three stages.
 */
import apiClient from './client';
import { asArray } from './unwrap';

/** DRF's paged envelope. Sub-resources use it; top-level lists may not. */
export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/**
 * A list plus how many exist in total.
 *
 * DRF pages these collections at a fixed size. Returning a bare array would
 * silently drop everything past the first page — the list would look complete
 * and be wrong. Carrying `count` lets the screen say so out loud.
 */
export interface Listing<T> {
  items: T[];
  count: number;
}

async function listing<T>(data: Page<T> | T[]): Promise<Listing<T>> {
  const items = asArray<T>(data);
  const count = Array.isArray(data) ? items.length : (data?.count ?? items.length);
  return { items, count };
}

/* ---------------- datasets ---------------- */

export type DatasetSource = 'corrected' | 'captured' | 'uploaded' | 'mixed';

export interface Dataset {
  id: number;
  name: string;
  description: string;
  source: DatasetSource;
  train_pct: number;
  val_pct: number;
  test_pct: number;
  split_label: string;
  row_count: number;
  /** Suites and tuning jobs that consume this — what breaks if you change it. */
  used_by: string[];
  created_at: string;
  updated_at: string;
}

export interface DatasetRow {
  id: number;
  inputs: Record<string, unknown>;
  expected: Record<string, unknown>;
  split: 'train' | 'val' | 'test';
  note: string;
  source_execution: number | null;
  created_at: string;
}

export interface DatasetStats {
  total: number;
  train: number;
  val: number;
  test: number;
}

export const datasetsService = {
  list: async (): Promise<Listing<Dataset>> => {
    const { data } = await apiClient.get<Page<Dataset> | Dataset[]>('/datasets/');
    return listing<Dataset>(data);
  },
  get: async (id: number | string): Promise<Dataset> =>
    (await apiClient.get<Dataset>(`/datasets/${id}/`)).data,
  create: async (body: Partial<Dataset>): Promise<Dataset> =>
    (await apiClient.post<Dataset>('/datasets/', body)).data,
  update: async (id: number | string, body: Partial<Dataset>): Promise<Dataset> =>
    (await apiClient.patch<Dataset>(`/datasets/${id}/`, body)).data,
  remove: async (id: number | string): Promise<void> => {
    await apiClient.delete(`/datasets/${id}/`);
  },

  // Rows are paged rather than inlined: a gold set runs to thousands, and
  // inlining would make the page slow in proportion to how much work you've done.
  rows: async (id: number | string, params?: { split?: string; page?: number }) =>
    (await apiClient.get<Page<DatasetRow>>(`/datasets/${id}/rows/`, { params })).data,
  stats: async (id: number | string): Promise<DatasetStats> =>
    (await apiClient.get<DatasetStats>(`/datasets/${id}/stats/`)).data,
};

/* ---------------- evals ---------------- */

export interface EvalRunSummary {
  id: number;
  status: string;
  score: number;
  /** null when there is no previous run — different from "no change". */
  delta: number | null;
  model: string;
  regressions: number;
  created_at: string;
}

export interface EvalSuite {
  id: number;
  name: string;
  description: string;
  agent: number | null;
  agent_name: string | null;
  dataset: number | null;
  dataset_name: string | null;
  case_count: number;
  latest: EvalRunSummary | null;
  created_at: string;
  updated_at: string;
}

export interface EvalCase {
  id: number;
  key: string;
  description: string;
  inputs: Record<string, unknown>;
  expected: Record<string, unknown>;
  weight: number;
}

export interface EvalRun {
  id: number;
  suite: number;
  suite_name: string;
  provider: string;
  model: string;
  status: string;
  total_cases: number;
  passed_cases: number;
  score: number;
  delta: number | null;
  /** Case keys that passed last run and fail now. The honest signal. */
  regressions: string[];
  error_message: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface EvalCaseResult {
  id: number;
  key: string;
  description: string;
  expected: Record<string, unknown>;
  got: Record<string, unknown>;
  passed: boolean;
  reason: string;
  duration_ms: number | null;
}

export const evalsService = {
  listSuites: async (): Promise<Listing<EvalSuite>> => {
    const { data } = await apiClient.get<Page<EvalSuite> | EvalSuite[]>('/evals/suites/');
    return listing<EvalSuite>(data);
  },
  getSuite: async (id: number | string): Promise<EvalSuite> =>
    (await apiClient.get<EvalSuite>(`/evals/suites/${id}/`)).data,
  createSuite: async (body: Partial<EvalSuite>): Promise<EvalSuite> =>
    (await apiClient.post<EvalSuite>('/evals/suites/', body)).data,
  removeSuite: async (id: number | string): Promise<void> => {
    await apiClient.delete(`/evals/suites/${id}/`);
  },

  cases: async (id: number | string): Promise<EvalCase[]> => {
    const { data } = await apiClient.get<EvalCase[]>(`/evals/suites/${id}/cases/`);
    return asArray<EvalCase>(data);
  },
  addCases: async (id: number | string, cases: Partial<EvalCase>[]): Promise<EvalCase[]> =>
    (await apiClient.post<EvalCase[]>(`/evals/suites/${id}/cases/`, cases)).data,

  runs: async (id: number | string): Promise<EvalRun[]> => {
    const { data } = await apiClient.get<EvalRun[]>(`/evals/suites/${id}/runs/`);
    return asArray<EvalRun>(data);
  },
  run: async (id: number | string, body?: { provider?: string; model?: string }): Promise<EvalRun> =>
    (await apiClient.post<EvalRun>(`/evals/suites/${id}/run/`, body ?? {})).data,

  getRun: async (runId: number | string): Promise<EvalRun> =>
    (await apiClient.get<EvalRun>(`/evals/runs/${runId}/`)).data,
  results: async (runId: number | string, only?: 'passed' | 'failed'): Promise<EvalCaseResult[]> => {
    const { data } = await apiClient.get<EvalCaseResult[]>(
      `/evals/runs/${runId}/results/`,
      { params: only ? { only } : undefined }
    );
    return asArray<EvalCaseResult>(data);
  },
};

/* ---------------- tuning ---------------- */

export interface TuningJob {
  id: number;
  name: string;
  base_model: string;
  dataset: number;
  dataset_name: string;
  dataset_rows: number;
  status: 'queued' | 'training' | 'completed' | 'deployed' | 'failed' | 'cancelled';
  epochs_total: number;
  epochs_done: number;
  progress_pct: number;
  /** null until scored — 0 would read as "scored zero". */
  accuracy: number | null;
  baseline_accuracy: number | null;
  accuracy_delta: number | null;
  /** Integer paise, so no float rounding on money. */
  cost_per_1k_paise: number | null;
  baseline_cost_per_1k_paise: number | null;
  cost_saving_pct: number | null;
  tuned_model_id: string;
  error_message: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export const tuningService = {
  list: async (): Promise<Listing<TuningJob>> => {
    const { data } = await apiClient.get<Page<TuningJob> | TuningJob[]>('/tuning/jobs/');
    return listing<TuningJob>(data);
  },
  get: async (id: number | string): Promise<TuningJob> =>
    (await apiClient.get<TuningJob>(`/tuning/jobs/${id}/`)).data,
  create: async (body: Partial<TuningJob>): Promise<TuningJob> =>
    (await apiClient.post<TuningJob>('/tuning/jobs/', body)).data,
  cancel: async (id: number | string): Promise<TuningJob> =>
    (await apiClient.post<TuningJob>(`/tuning/jobs/${id}/cancel/`)).data,
  deploy: async (id: number | string): Promise<TuningJob> =>
    (await apiClient.post<TuningJob>(`/tuning/jobs/${id}/deploy/`)).data,
  remove: async (id: number | string): Promise<void> => {
    await apiClient.delete(`/tuning/jobs/${id}/`);
  },
};

/** Paise -> "₹0.42". Money is integer paise on the wire; formatting is a view concern. */
export const formatPaise = (paise: number | null): string =>
  paise === null ? '—' : `₹${(paise / 100).toFixed(2)}`;
