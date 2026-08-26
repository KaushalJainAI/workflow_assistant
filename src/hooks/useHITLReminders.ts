/**
 * Turns backend HITL nudges into OS-level notifications.
 *
 * Mounted once in the authenticated Layout. The backend decides *whether* to
 * nudge (escalation ladder, hourly, digest — see notifications/reminders.py);
 * this hook only decides how it surfaces on the device.
 *
 * Scope worth being honest about: the browser Notifications API only fires
 * while a tab is open, backgrounded or not. Delivery to a fully closed browser
 * needs Web Push (service worker + VAPID), which this does not implement — the
 * daily email digest is the closed-browser channel.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../lib/websocket';
import { usePublishHitlSocketLive } from './useHitlPending';
import type { HITLReminderPayload } from '../api/notifications';

type ReminderMessage = {
  type: string;
  data?: HITLReminderPayload;
};

/** Browser support + current grant, without prompting. */
export function deviceNotificationState(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/**
 * Prompt for permission. Must be called from a user gesture — browsers ignore
 * (Chrome) or reject (Safari) an ungated request, which is why this is exported
 * for the Settings toggle rather than fired on mount.
 */
export async function requestDeviceNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function useHITLReminders(enabled: boolean = true) {
  const queryClient = useQueryClient();
  // Collapses repeat nudges for one request onto a single OS notification
  // instead of stacking three toasts over a day.
  const shownRef = useRef<Map<string, Notification>>(new Map());

  const raise = useCallback((payload: HITLReminderPayload) => {
    if (deviceNotificationState() !== 'granted') return;

    // Keyed by request so a later rung supersedes the earlier one, but tagged
    // per stage so it still alerts: `renotify` is service-worker-only, and
    // reusing a tag on the page-level API replaces the notification silently.
    const key = payload.request_id ? `hitl-${payload.request_id}` : `hitl-${payload.kind}`;
    try {
      const notification = new Notification(payload.title, {
        body: payload.body,
        tag: `${key}-${payload.stage ?? 0}`,
        requireInteraction: payload.kind !== 'hitl_digest',
        data: payload,
      });

      notification.onclick = () => {
        window.focus();
        window.location.assign(payload.action_url || '/inbox');
        notification.close();
      };

      shownRef.current.get(key)?.close();
      shownRef.current.set(key, notification);
    } catch {
      // Some browsers throw on constructing Notification outside a service
      // worker (notably Android Chrome). Nothing to recover — the in-app row
      // and the Inbox badge still carry the request.
    }
  }, []);

  const handleMessage = useCallback(
    (message: ReminderMessage) => {
      if (message.type === 'reminder' && message.data) {
        raise(message.data);
      }
      // Any HITL traffic means the pending set may have moved. Shared key with
      // the Sidebar badge, Inbox and Overview.
      if (message.type === 'reminder' || message.type === 'new_request') {
        queryClient.invalidateQueries({ queryKey: ['hitl'] });
      }
    },
    [raise, queryClient],
  );

  const { isConnected } = useSocket<ReminderMessage>({
    path: '/hitl/',
    enabled,
    onMessage: handleMessage,
  });

  // Tells useHitlPending how hard the badge queries have to poll: this socket
  // pushes new requests, so while it is up they only need a slow backstop.
  usePublishHitlSocketLive(isConnected);

  useEffect(() => {
    const shown = shownRef.current;
    return () => {
      shown.forEach((n) => n.close());
      shown.clear();
    };
  }, []);

  return { connected: isConnected };
}

export default useHITLReminders;
