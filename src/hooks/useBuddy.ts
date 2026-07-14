import { useEffect, useRef, useState, useCallback } from 'react';
import { tokenManager } from '../api/client';

const WS_BASE = import.meta.env.VITE_WS_URL || `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;

export interface BuddyAction {
  type: string;
  action: string;
  parameters: Record<string, any>;
}

export function useBuddy(enabled: boolean = true) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [buddyAction, setBuddyAction] = useState<string | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalClose = useRef(false);

  // Capture screen context on demand — called by callers, not continuously.
  const captureContext = useCallback(() => {
    const interactables = document.querySelectorAll('button, a, input, textarea, select, [role="button"]');
    const elements: any[] = [];

    interactables.forEach((el, index) => {
      const htmlEl = el as HTMLElement;
      if (htmlEl.offsetParent === null) return;

      const buddyId = `buddy-node-${index}`;
      htmlEl.setAttribute('data-buddy-id', buddyId);

      elements.push({
        buddy_id: buddyId,
        tag: htmlEl.tagName.toLowerCase(),
        text: htmlEl.innerText?.trim() || htmlEl.getAttribute('aria-label') || htmlEl.getAttribute('placeholder') || '',
        type: htmlEl.getAttribute('type') || undefined,
      });
    });

    return {
      url: window.location.href,
      title: document.title,
      interactables: elements,
    };
  }, []);

  const sendContextUpdate = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'context_update',
        context: captureContext(),
      }));
    }
  }, [captureContext]);

  const executeAction = useCallback((action: string, params: Record<string, any>) => {
    setBuddyAction(`Buddy is executing: ${action}`);
    setTimeout(() => setBuddyAction(null), 3000);

    if (action === 'frontend_click') {
      const el = document.querySelector(`[data-buddy-id="${params.buddy_id}"]`) as HTMLElement;
      if (el) {
        const originalOutline = el.style.outline;
        el.style.outline = '4px solid #3b82f6';
        setTimeout(() => {
          el.style.outline = originalOutline;
          el.click();
        }, 500);
      }
    } else if (action === 'frontend_fill') {
      const el = document.querySelector(`[data-buddy-id="${params.buddy_id}"]`) as HTMLInputElement | HTMLTextAreaElement;
      if (el) {
        const originalOutline = el.style.outline;
        el.style.outline = '4px solid #3b82f6';
        setTimeout(() => {
          el.style.outline = originalOutline;
          el.value = params.value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }, 500);
      }
    } else if (action === 'frontend_navigate') {
      if (params.url) {
        window.location.href = params.url;
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      intentionalClose.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
      setIsConnected(false);
      return;
    }

    intentionalClose.current = false;

    const connect = () => {
      const token = tokenManager.getAccessToken();
      const ws = new WebSocket(`${WS_BASE}/buddy/?token=${token}`);

      ws.onopen = () => {
        reconnectAttempt.current = 0;
        setIsConnected(true);
        // Send context once on connect so the backend has a baseline.
        sendContextUpdate();
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'trigger_action') {
          executeAction(data.action, data.parameters);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Guard: if this socket is no longer the active one (e.g. a new connect()
        // call already ran) or the close was intentional, do not reconnect.
        if (intentionalClose.current || wsRef.current !== ws) return;

        // Exponential backoff: 3s, 6s, 12s, 24s, 48s, cap at 60s.
        const delay = Math.min(3000 * 2 ** reconnectAttempt.current, 60000);
        reconnectAttempt.current += 1;
        reconnectTimer.current = setTimeout(connect, delay);
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      intentionalClose.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [enabled, executeAction, sendContextUpdate]);

  // Send context on navigation changes only (not on every DOM mutation).
  useEffect(() => {
    if (!isConnected || !enabled) return;

    const handleNavigation = () => sendContextUpdate();

    window.addEventListener('popstate', handleNavigation);

    // Intercept pushState/replaceState to catch SPA route changes.
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
