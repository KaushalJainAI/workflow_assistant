/**
 * Node Data Types - n8n Compatible
 * 
 * Standardized data structures for workflow node communication.
 * Based on n8n's item-based data flow model.
 */

/**
 * Binary data for files passed between nodes
 */
export interface BinaryData {
  /** Base64 encoded file content */
  data: string;
  /** MIME type of the file */
  mimeType: string;
  /** Original filename */
  fileName?: string;
  /** File extension without dot */
  fileExtension?: string;
  /** File size in bytes */
  fileSize?: number;
}

/**
 * Paired item reference for data lineage tracking
 */
export interface PairedItem {
  /** Index of the source item */
  item: number;
  /** Index of the input (for nodes with multiple inputs) */
  input?: number;
}

/**
 * Single item in node input/output - n8n compatible
 * 
 * Each item represents one unit of data flowing through the workflow.
 * The `json` key holds the primary data payload.
 */
export interface NodeItem {
  /** Primary JSON data payload */
  json: Record<string, unknown>;
  /** Binary file data (base64 encoded) */
  binary?: Record<string, BinaryData>;
  /** Reference to source item for traceability */
  pairedItem?: PairedItem;
}

/**
 * Node execution input/output container
 */
export interface NodeDataContainer {
  /** Array of items */
  items: NodeItem[];
}

/**
 * Helper to normalize any data to items format
 */
export function normalizeToItems(data: unknown): NodeItem[] {
  if (!data) {
    return [];
  }
  
  if (Array.isArray(data)) {
    return data.map((item, index) => {
      if (typeof item === 'object' && item !== null && 'json' in item) {
        return item as NodeItem;
      }
      return { json: item as Record<string, unknown>, pairedItem: { item: index } };
    });
  }
  
  if (typeof data === 'object' && data !== null) {
    if ('json' in data) {
      return [data as NodeItem];
    }
    if ('items' in data && Array.isArray((data as any).items)) {
      return normalizeToItems((data as any).items);
    }
    return [{ json: data as Record<string, unknown> }];
  }
  
  return [{ json: { value: data } }];
}

/**
 * Get display-friendly item count string
 */
export function getItemCountLabel(items: NodeItem[] | unknown): string {
  const normalized = Array.isArray(items) ? items : normalizeToItems(items);
  const count = normalized.length;
  return count === 1 ? '1 item' : `${count} items`;
}
