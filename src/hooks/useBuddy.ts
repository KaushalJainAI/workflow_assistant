import { useCallback, useEffect, useState } from 'react';
import { useSocket } from '../lib/websocket';

export interface BuddyAction {
  type: string;
  action: string;
  parameters: Record<string, any>;
}

interface BuddyMessage {
  type: string;
  action: string;
  parameters: Record<string, any>;
}

/** Highlight duration before a Buddy-driven interaction actually fires. */
const HIGHLIGHT_MS = 500;
const HIGHLIGHT_STYLE = '4px solid #3b82f6';

/** Briefly outlines an element so the user can see what Buddy is about to touch. */
function withHighlight(el: HTMLElement, apply: () => void) {
  const original = el.style.outline;
  el.style.outline = HIGHLIGHT_STYLE;
  setTimeout(() => {
    el.style.outline = original;
    apply();
  }, HIGHLIGHT_MS);
}

function findTarget<T extends HTMLElement>(buddyId: string): T | null {
  return document.querySelector<T>(`[data-buddy-id="${buddyId}"]`);
}

export function useBuddy(enabled: boolean = true) {
  const [buddyAction, setBuddyAction] = useState<string | null>(null);

  /**
   * Snapshots the interactable elements on screen. Called on demand (connect,
   * navigation, message send) — never from a DOM observer, which would fire on
   * every React re-render.
   */
  const captureContext = useCallback(() => {
    const interactables = document.querySelectorAll(
      'button, a, input, textarea, select, [role="button"]',
    );
    const elements: any[] = [];

    interactables.forEach((el, index) => {
      const htmlEl = el as HTMLElement;
      if (htmlEl.offsetParent === null) return;

      const buddyId = `buddy-node-${index}`;
      htmlEl.setAttribute('data-buddy-id', buddyId);

      elements.push({
        buddy_id: buddyId,
        tag: htmlEl.tagName.toLowerCase(),
        text:
          htmlEl.innerText?.trim() ||
          htmlEl.getAttribute('aria-label') ||
          htmlEl.getAttribute('placeholder') ||
          '',
        type: htmlEl.getAttribute('type') || undefined,
      });
    });

    return { url: window.location.href, title: document.title, interactables: elements };
  }, []);

  const executeAction = useCallback((action: string, params: Record<string, any>) => {
    setBuddyAction(`Buddy is executing: ${action}`);
    setTimeout(() => setBuddyAction(null), 3000);

    switch (action) {
      case 'frontend_click': {
        const el = findTarget(params.buddy_id);
        if (el) withHighlight(el, () => el.click());
        break;
      }
      case 'frontend_fill': {
        const el = findTarget<HTMLInputElement | HTMLTextAreaElement>(params.buddy_id);
        if (el) {
          withHighlight(el, () => {
            el.value = params.value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          });
        }
        break;
      }
      case 'frontend_navigate': {
        if (params.url) window.location.href = params.url;
        break;
      }
    }
  }, []);

  const handleMessage = useCallback(
    (data: BuddyMessage) => {
      if (data.type === 'trigger_action') executeAction(data.action, data.parameters);
    },
    [executeAction],
  );

  const { isConnected, send } = useSocket<BuddyMessage>({
    path: '/buddy/',
    enabled,
    // Buddy connects for guests too; the backend tolerates a missing token.
    requireToken: false,
    onMessage: handleMessage,
  });

  const sendContextUpdate = useCallback(() => {
    send({ type: 'context_update', context: captureContext() });
  }, [send, captureContext]);

  // Baseline context once the socket opens, then only on navigation — see
  // `feedback_websocket_patterns` for why this is not DOM-observer driven.
  useEffect(() => {
    if (!isConnected || !enabled) return;

    sendContextUpdate();

    const handleNavigation = () => sendContextUpdate();
    window.addEventListener('popstate', handleNavigation);

    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);

    history.pushState = (...args) => {
      origPush(...args);
      handleNavigation();
    };
    history.replaceState = (...args) => {
      origReplace(...args);
      handleNavigation();
    };

    return () => {
      window.removeEventListener('popstate', handleNavigation);
      history.pushState = origPush;
      history.replaceState = origReplace;
    };
  }, [isConnected, enabled, sendContextUpdate]);

  return { isConnected, captureContext, buddyAction };
}
