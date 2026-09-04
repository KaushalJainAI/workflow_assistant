/**
 * In-flight state for one streamed assistant turn.
 *
 * These eleven fields were eleven `useState` slices in `StandaloneChat`, mutated
 * by a switch over SSE event types and then cleared field-by-field in three
 * different places. Two of those reset blocks had already drifted out of sync
 * with each other. As a reducer the transitions are declared once and `reset` is
 * a single action, so a new live field cannot be half-wired.
 *
 * Cross-cutting effects of a stream event — appending to the transcript, the
 * loading flag, session intent — stay with the component; this hook owns only
 * the state that lives and dies with the turn.
 */

import { useCallback, useMemo, useReducer } from 'react';
import type { ChartSpec, HtmlArtifact as HtmlArtifactData } from '../api/chat';
import type { ChatMediaItem, CodeExecutionEntry } from '../api/chat';

/**
 * One frame off the SSE wire. The payload shape varies per `type` and is not
 * described by any shared schema, so fields are read defensively rather than
 * modelled as a discriminated union that would drift from the backend.
 *
 * The index type is `unknown`, not `any`. That is what forces every read below
 * through `str()` / `arr()`, and it closed a real defect: `state.content +
 * event.content` on a frame that omitted `content` appended the literal string
 * "undefined" to the user's answer, and nothing typed as `any` would ever have
 * complained.
 */
export type StreamEvent = { type: string } & Record<string, unknown>;

/** A frame field as a string, or '' — never the text "undefined". */
const str = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * A frame field as an array. The cast is the one unavoidable assertion in this
 * file: the wire carries no schema, so `Array.isArray` is the only check
 * available and the element type is the caller's expectation, not a guarantee.
 */
const arr = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

/** A frame field as a plain object, for tool arguments. */
const obj = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** A frame field as a number, or undefined when absent or malformed. */
const num = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

export interface StreamActivity {
  type: 'tool' | 'thought';
  tool?: string;
  args?: Record<string, unknown>;
  iteration?: number;
  thought?: string;
}

/**
 * One attachment the chosen model could not accept. Carries its id so the
 * agent can be told which file it is; see `history.describe_for_model`.
 */
export interface BlockedAttachment {
  id?: number;
  name?: string;
  reason?: string;
  [key: string]: unknown;
}

export interface StreamSource {
  title: string;
  url: string;
  snippet?: string;
  thumbnail?: string;
  favicon?: string;
}

export interface PendingToolCall {
  tool: string;
  args: Record<string, unknown>;
  call_id: string;
}

export interface ChatStreamState {
  status: { phase: string; message: string } | null;
  activity: StreamActivity[];
  sources: StreamSource[];
  images: ChatMediaItem[];
  videos: ChatMediaItem[];
  thinking: string;
  content: string;
  /**
   * Reserved: no current backend event populates this, so the code-execution
   * panel that reads it stays collapsed. Kept so the field does not have to be
   * re-threaded when the backend starts emitting it.
   */
  codeExecutions: CodeExecutionEntry[];
  artifacts: HtmlArtifactData[];
  charts: ChartSpec[];
  blockedAttachments: { message: string; items: BlockedAttachment[] } | null;
  pendingToolCall: PendingToolCall | null;
}

const EMPTY: ChatStreamState = {
  status: null,
  activity: [],
  sources: [],
  images: [],
  videos: [],
  thinking: '',
  content: '',
  codeExecutions: [],
  artifacts: [],
  charts: [],
  blockedAttachments: null,
  pendingToolCall: null,
};

type Action =
  | { type: 'event'; event: StreamEvent }
  | { type: 'reset' }
  | { type: 'clearStatus' }
  | { type: 'clearPendingToolCall' }
  | { type: 'dismissBlockedAttachments' };

/** Consecutive `thought` traces collapse into one entry rather than stacking. */
function appendActivity(activity: StreamActivity[], event: StreamEvent): StreamActivity[] {
  if (event.sub_type === 'thought') {
    const last = activity[activity.length - 1];
    if (last?.type === 'thought') {
      return [...activity.slice(0, -1), { ...last, thought: str(event.content) }];
    }
    return [...activity, { type: 'thought', thought: str(event.content) }];
  }
  return [
    ...activity,
    {
      type: 'tool',
      tool: str(event.tool),
      args: obj(event.args),
      iteration: num(event.iteration),
      thought: str(event.thought),
    },
  ];
}

function reduceEvent(state: ChatStreamState, event: StreamEvent): ChatStreamState {
  switch (event.type) {
    case 'status':
      return { ...state, status: { phase: str(event.phase), message: str(event.message) } };
    case 'thinking_chunk':
      return { ...state, thinking: state.thinking + str(event.content) };
    case 'content_chunk':
      return { ...state, content: state.content + str(event.content) };
    case 'content_reset':
      // What streamed was a preamble to a tool call ("let me search for..."),
      // not the answer. Drop it so the real answer starts from a clean buffer.
      return { ...state, content: '' };
    case 'agent_trace':
      return { ...state, activity: appendActivity(state.activity, event) };
    case 'sources_update':
      return { ...state, sources: arr<StreamSource>(event.sources) };
    case 'images_update':
      return { ...state, images: arr<ChatMediaItem>(event.images) };
    case 'videos_update':
      return { ...state, videos: arr<ChatMediaItem>(event.videos) };
    case 'html_artifact':
      return {
        ...state,
        artifacts: [
          ...state.artifacts,
          {
            title: str(event.title),
            html: str(event.html),
            width: num(event.width),
            height: num(event.height),
          },
        ],
      };
    case 'chart':
      // The whole spec is appended as sent. Charts are not merged or deduped:
      // a turn that draws two charts meant two charts, and the backend has
      // already validated each one.
      return {
        ...state,
        charts: [...state.charts, event as unknown as ChartSpec],
      };
    case 'attachments_blocked':
      // Persistent, not a transient toast: the user needs to still see this
      // while they go and change the model, which is the action it asks for.
      return {
        ...state,
        blockedAttachments: {
          message: str(event.message),
          items: arr<BlockedAttachment>(event.items),
        },
      };
    case 'ask_permission':
      return {
        ...state,
        pendingToolCall: {
          tool: str(event.tool),
          args: obj(event.args),
          call_id: str(event.call_id),
        },
      };
    case 'done':
      // The turn is over, so everything transient goes. Two survive: a
      // blocked-attachment notice describes the turn that just finished, and an
      // outstanding approval card is dismissed by whoever answers it.
      return {
        ...EMPTY,
        blockedAttachments: state.blockedAttachments,
        pendingToolCall: state.pendingToolCall,
      };
    case 'error':
      return { ...state, status: null };
    default:
      return state;
  }
}

function reducer(state: ChatStreamState, action: Action): ChatStreamState {
  switch (action.type) {
    case 'event':
      return reduceEvent(state, action.event);
    case 'reset':
      return EMPTY;
    case 'clearStatus':
      return { ...state, status: null };
    case 'clearPendingToolCall':
      return { ...state, pendingToolCall: null };
    case 'dismissBlockedAttachments':
      return { ...state, blockedAttachments: null };
  }
}

export function useChatStream() {
  const [live, dispatch] = useReducer(reducer, EMPTY);

  const applyEvent = useCallback((event: StreamEvent) => dispatch({ type: 'event', event }), []);
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);
  const clearStatus = useCallback(() => dispatch({ type: 'clearStatus' }), []);
  const clearPendingToolCall = useCallback(() => dispatch({ type: 'clearPendingToolCall' }), []);
  const dismissBlockedAttachments = useCallback(
    () => dispatch({ type: 'dismissBlockedAttachments' }),
    [],
  );

  return useMemo(
    () => ({ live, applyEvent, reset, clearStatus, clearPendingToolCall, dismissBlockedAttachments }),
    [live, applyEvent, reset, clearStatus, clearPendingToolCall, dismissBlockedAttachments],
  );
}
