/**
 * Turns backend nudges into something the user actually sees.
 *
 * Mounted once in the authenticated Layout. The backend decides *whether* to
 * nudge (escalation ladder, hourly, digest — see notifications/reminders.py);
 * this hook only decides how it surfaces on the device.
 *
 * Two surfaces, not one: an in-app toast always fires (sonner is mounted in
 * App), and an OS-level Notification fires on top when the browser grant is
 * held. The old version only did the second and returned silently without the
 * grant — which is why "notifications don't work" out of the box: nobody had
 * visited Settings to enable them yet.
 *
 * Scope worth being honest about: the browser Notifications API only fires
 * while a tab is open, backgrounded or not. Delivery to a fully closed browser
 * goes through Web Push (service worker `public/sw.js` + VAPID, subscribed in
 * Settings via useWebPush) — the daily email digest remains a second
 * closed-browser channel.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useSocket } from '../lib/websocket';
import { usePublishHitlSocketLive } from './useHitlPending';
import type { HITLReminderPayload } from '../api/notifications';

type SocketMessage = {
  type: string;
  // `reminder` carries HITLReminderPayload; `new_request` carries the HITL
  // row ({request_id, title, message}); `notification` carries the generic
  // Notification row ({title, body|message, action_url}). Read defensively.
  data?: Record<string, unknown> & Partial<HITLReminderPayload>;
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

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function useHITLReminders(enabled: boolean = true) {
  const queryClient = useQueryClient();
  // Collapses repeat nudges for one request onto a single OS notification
  // instead of stacking three toasts over a day.
  const shownRef = useRef<Map<string, Notification>>(new Map());

  const raiseOs = useCallback((title: string, body: string, actionUrl: string, tagKey: string, stage?: number) => {
    if (deviceNotificationState() !== 'granted') return;
    try {
      const notification = new Notification(title, {
        body,
        tag: `${tagKey}-${stage ?? 0}`,
        requireInteraction: true,
      });

      notification.onclick = () => {
        window.focus();
        window.location.assign(actionUrl);
        notification.close();
      };

      shownRef.current.get(tagKey)?.close();
      shownRef.current.set(tagKey, notification);
    } catch {
      // Some browsers throw on constructing Notification outside a service
      // worker (notably Android Chrome). The toast below already fired.
    }
  }, []);

  const surface = useCallback(
    (title: string, body: string, actionUrl: string, tagKey: string, stage?: number) => {
      if (!title && !body) return;
      toast.info(title || 'Notification', {
        description: body || undefined,
        action: actionUrl
          ? { label: 'Open', onClick: () => window.location.assign(actionUrl) }
          : undefined,
        duration: 8000,
      });
      raiseOs(title, body, actionUrl, tagKey, stage);
    },
    [raiseOs],
  );

  const handleMessage = useCallback(
    (message: SocketMessage) => {
      const d = message.data ?? {};
      if (message.type === 'reminder') {
        const title = asText(d.title);
        const body = asText(d.body ?? d.message);
        const actionUrl = asText(d.action_url) || '/runs';
        const tagKey = asText(d.request_id) ? `hitl-${asText(d.request_id)}` : `hitl-${asText(d.kind) || 'reminder'}`;
        surface(title, body, actionUrl, tagKey, typeof d.stage === 'number' ? d.stage : undefined);
        queryClient.invalidateQueries({ queryKey: ['hitl'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      } else if (message.type === 'new_request') {
        const title = asText(d.title) || 'Agent needs you';
        const body = asText(d.message ?? d.body);
        surface(title, body, '/runs', `hitl-${asText(d.request_id) || 'new'}`);
        queryClient.invalidateQueries({ queryKey: ['hitl'] });
      } else if (message.type === 'notification') {
        const title = asText(d.title) || 'Notification';
        const body = asText(d.body ?? d.message);
        const actionUrl = asText(d.action_url) || '/settings';
        surface(title, body, actionUrl, `notif-${asText(d.id) || title}`);
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        // A generic notification can also be an HITL-adjacent row (chat
        // approval), so keep the badge honest too.
        queryClient.invalidateQueries({ queryKey: ['hitl'] });
      }
    },
    [surface, queryClient],
  );

  const { isConnected } = useSocket<SocketMessage>({
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
