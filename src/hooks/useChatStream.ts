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
import type { HtmlArtifact as HtmlArtifactData } from '../api/chat';

/**
 * One frame off the SSE wire. The payload shape varies per `type` and is not
 * described by any shared schema, so fields are read defensively rather than
 * modelled as a discriminated union that would drift from the backend.
 */
export type StreamEvent = { type: string } & Record<string, any>;

export interface StreamActivity {
  type: 'tool' | 'thought';
  tool?: string;
  args?: any;
  iteration?: number;
  thought?: string;
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
  args: any;
  call_id: string;
}

export interface ChatStreamState {
  status: { phase: string; message: string } | null;
  activity: StreamActivity[];
  sources: StreamSource[];
  images: any[];
  videos: any[];
  thinking: string;
  content: string;
  /**
   * Reserved: no current backend event populates this, so the code-execution
   * panel that reads it stays collapsed. Kept so the field does not have to be
   * re-threaded when the backend starts emitting it.
   */
  codeExecutions: any[];
  artifacts: HtmlArtifactData[];
  blockedAttachments: { message: string; items: any[] } | null;
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
      return [...activity.slice(0, -1), { ...last, thought: event.content }];
    }
    return [...activity, { type: 'thought', thought: event.content }];
  }
  return [
    ...activity,
    {
      type: 'tool',
      tool: event.tool,
      args: event.args,
      iteration: event.iteration,
      thought: event.thought,
    },
  ];
}

function reduceEvent(state: ChatStreamState, event: StreamEvent): ChatStreamState {
  switch (event.type) {
    case 'status':
      return { ...state, status: { phase: event.phase, message: event.message } };
    case 'thinking_chunk':
      return { ...state, thinking: state.thinking + event.content };
    case 'content_chunk':
      return { ...state, content: state.content + event.content };
    case 'content_reset':
      // What streamed was a preamble to a tool call ("let me search for..."),
      // not the answer. Drop it so the real answer starts from a clean buffer.
      return { ...state, content: '' };
    case 'agent_trace':
      return { ...state, activity: appendActivity(state.activity, event) };
    case 'sources_update':
      return { ...state, sources: event.sources || [] };
    case 'images_update':
      return { ...state, images: event.images || [] };
    case 'videos_update':
      return { ...state, videos: event.videos || [] };
    case 'html_artifact':
      return {
        ...state,
        artifacts: [
          ...state.artifacts,
          { title: event.title, html: event.html, width: event.width, height: event.height },
        ],
      };
    case 'attachments_blocked':
      // Persistent, not a transient toast: the user needs to still see this
      // while they go and change the model, which is the action it asks for.
      return { ...state, blockedAttachments: { message: event.message, items: event.items || [] } };
    case 'ask_permission':
      return {
        ...state,
        pendingToolCall: { tool: event.tool, args: event.args, call_id: event.call_id },
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
