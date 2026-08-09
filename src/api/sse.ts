/**
 * Server-sent-event stream reader.
 *
 * The chat endpoints stream newline-delimited `data: {json}` frames over a
 * plain POST rather than EventSource (EventSource cannot send a body or an
 * Authorization header). Every caller previously inlined the same
 * reader/decoder/buffer loop; the copies had already drifted — one skipped the
 * `response.ok` check, so a 500 surfaced as an empty stream instead of an error.
 */

import { tokenManager } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export interface SseEvent {
  type: string;
  [key: string]: any;
}

export interface StreamRequest {
  /** Path relative to the API root, e.g. `/chat/sessions/1/message/stream/`. */
  path: string;
  body: Record<string, unknown>;
  onEvent: (event: SseEvent) => void;
  signal?: AbortSignal;
  /** Attach the bearer token. Off for guest endpoints, which reject it. */
  authenticated?: boolean;
}

/**
 * Splits a text chunk into complete `data:` frames, returning the trailing
 * partial line for the next chunk to finish.
 */
function drainFrames(buffer: string, onEvent: (event: SseEvent) => void): string {
  const lines = buffer.split('\n');
  const remainder = lines.pop() ?? '';

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    try {
      onEvent(JSON.parse(line.slice(6)));
    } catch {
      // A malformed frame should not abort a stream that is otherwise fine.
    }
  }
  return remainder;
}

/** POSTs `body` and invokes `onEvent` for each SSE frame until the stream ends. */
export async function streamSse({
  path,
  body,
  onEvent,
  signal,
  authenticated = true,
}: StreamRequest): Promise<void> {
  const token = authenticated ? tokenManager.getAccessToken() : null;

  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`Stream request failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = drainFrames(buffer, onEvent);
  }

  // A final frame may arrive without its trailing newline.
  drainFrames(`${buffer}\n`, onEvent);
}
