import { useEffect, useRef, useState, useCallback } from 'react';
import { tokenManager } from '../api/client';

export interface BuddyAction {
  type: string;
  action: string;
  parameters: Record<string, any>;
}

export function useBuddy(enabled: boolean = true) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [buddyAction, setBuddyAction] = useState<string | null>(null);

  // Capture screen context
  const captureContext = useCallback(() => {
    const interactables = document.querySelectorAll('button, a, input, textarea, select, [role="button"]');
    const elements: any[] = [];

    interactables.forEach((el, index) => {
      const htmlEl = el as HTMLElement;
      // Skip hidden elements
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
      const context = captureContext();
      wsRef.current.send(JSON.stringify({
        type: 'context_update',
        context
      }));
    }
  }, [captureContext]);

  // Execute received actions
  const executeAction = useCallback((action: string, params: Record<string, any>) => {
    setBuddyAction(`Buddy is executing: ${action}`);
    setTimeout(() => setBuddyAction(null), 3000);

    if (action === 'frontend_click') {
      const el = document.querySelector(`[data-buddy-id="${params.buddy_id}"]`) as HTMLElement;
      if (el) {
        // Visual feedback
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
      if (wsRef.current) {
        wsRef.current.close();
      }
      setIsConnected(false);
      return;
    }

    const connect = () => {
      const token = tokenManager.getAccessToken();
      const wsUrl = `ws://${window.location.host.split(':')[0]}:8000/ws/buddy/?token=${token}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('Buddy WS connected');
        setIsConnected(true);
        // Initial context sync
        sendContextUpdate();
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'trigger_action') {
          executeAction(data.action, data.parameters);
        }
      };

      ws.onclose = () => {
        console.log('Buddy WS disconnected');
        setIsConnected(false);
        // Reconnect after 3s
        setTimeout(connect, 3000);
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [enabled, executeAction, sendContextUpdate]);

  // Optionally set up an observer to periodically update context when DOM changes
  useEffect(() => {
    if (!isConnected || !enabled) return;
    
    // Send context updates when mutations occur, debounced
    let timeout: ReturnType<typeof setTimeout>;
    const observer = new MutationObserver(() => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        sendContextUpdate();
      }, 1000);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      clearTimeout(timeout);
    };
  }, [isConnected, enabled, sendContextUpdate]);

  return { isConnected, captureContext, buddyAction };
}
