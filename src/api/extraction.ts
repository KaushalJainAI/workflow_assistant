/**
 * Extract — schemas and the rows they produce.
 *
 * The review queue is the part that carries weight: anything below the schema's
 * confidence threshold is held rather than accepted, and clearing it is recorded
 * against a person. That is what makes the output usable for accounting.
 */
import apiClient from './client';
import { asArray } from './unwrap';
import type { Listing, Page } from './improve';

export type FieldType = 'string' | 'number' | 'date' | 'currency' | 'boolean';

export interface SchemaField {
  name: string;
  label?: string;
  type?: FieldType;
  required?: boolean;
}

export interface ExtractionSchema {
  id: number;
  name: string;
  description: string;
  fields: SchemaField[];
  field_count: number;
  source_kind: 'upload' | 'gmail' | 'gdrive';
  source_ref: string;
  /** Fraction, not percent. Below this a row is held for review. */
  confidence_threshold: number;
  row_count: number;
  review_count: number;
  created_at: string;
  updated_at: string;
}

export type RowStatus = 'accepted' | 'needs_review' | 'reviewed' | 'rejected';

export interface ExtractedRow {
  id: number;
  document_name: string;
  document: number | null;
  data: Record<string, unknown>;
  /** Per-field confidence, so review can point at the offending cell. */
  field_confidence: Record<string, number>;
  confidence: number;
  status: RowStatus;
  reviewed_at: string | null;
  created_at: string;
}

const extractionService = {
  listSchemas: async (): Promise<Listing<ExtractionSchema>> => {
    const { data } = await apiClient.get<Page<ExtractionSchema> | ExtractionSchema[]>(
      '/extraction/schemas/'
    );
    const items = asArray<ExtractionSchema>(data);
    return {
      items,
      count: Array.isArray(data) ? items.length : (data?.count ?? items.length),
    };
  },
  getSchema: async (id: number | string): Promise<ExtractionSchema> =>
    (await apiClient.get<ExtractionSchema>(`/extraction/schemas/${id}/`)).data,
  createSchema: async (body: Partial<ExtractionSchema>): Promise<ExtractionSchema> =>
    (await apiClient.post<ExtractionSchema>('/extraction/schemas/', body)).data,
  updateSchema: async (
    id: number | string,
    body: Partial<ExtractionSchema>
  ): Promise<ExtractionSchema> =>
    (await apiClient.patch<ExtractionSchema>(`/extraction/schemas/${id}/`, body)).data,
  removeSchema: async (id: number | string): Promise<void> => {
    await apiClient.delete(`/extraction/schemas/${id}/`);
  },

  rows: async (id: number | string, params?: { status?: RowStatus; page?: number }) =>
    (await apiClient.get<Page<ExtractedRow>>(`/extraction/schemas/${id}/rows/`, { params })).data,

  /**
   * Accept a held row, optionally correcting it first. The response says whether
   * the values changed, so a correction can be offered to a dataset instead of
   * being thrown away — a human judgement is the most valuable training example
   * there is.
   */
  review: async (
    rowId: number | string,
    body?: { data?: Record<string, unknown>; reject?: boolean }
  ): Promise<ExtractedRow & { corrected: boolean }> =>
    (await apiClient.post<ExtractedRow & { corrected: boolean }>(
      `/extraction/rows/${rowId}/review/`,
      body ?? {}
    )).data,
};

export default extractionService;
