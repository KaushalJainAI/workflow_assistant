import { asArray } from './unwrap';
import apiClient from './client';

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  /** Payload shape varies by notification type; read defensively. */
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

/** Per-user delivery rules for HITL nudges. Mirrors NotificationPreference. */
export interface NotificationPreferences {
  device_notifications_enabled: boolean;
  hitl_escalation_enabled: boolean;
  hourly_reminders_enabled: boolean;
  daily_digest_enabled: boolean;
  /** 'HH:MM:SS', local to `timezone`. */
  daily_digest_time: string;
  /** Blank falls back to the profile timezone; `effective_timezone` resolves it. */
  timezone: string;
  effective_timezone: string;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  /** Read-only bookkeeping — the once-per-day email cap. */
  last_digest_sent_on: string | null;
  last_hourly_sent_at: string | null;
  updated_at: string;
}

/** A nudge pushed over ws/hitl/ that the client turns into an OS notification. */
export interface HITLReminderPayload {
  kind: 'hitl_request' | 'hitl_reminder' | 'hitl_digest';
  title: string;
  body: string;
  request_id?: string;
  stage?: number;
  pending_count?: number;
  action_url?: string;
}

export const notificationsService = {
  async getNotifications(): Promise<Notification[]> {
    const response = await apiClient.get('/notifications/');
    // DRF returns {count, next, previous, results} for this router viewset, but
    // the signature says Notification[] — TypeScript believed it and the
    // .filter() in NotificationsTab threw "e.filter is not a function".
    return asArray<Notification>(response.data);
  },

  async markAsRead(id: number): Promise<void> {
    await apiClient.post(`/notifications/${id}/mark_read/`, {});
  },

  async markAllAsRead(): Promise<void> {
    await apiClient.post('/notifications/mark_all_read/', {});
  },

  async getPreferences(): Promise<NotificationPreferences> {
    const response = await apiClient.get<NotificationPreferences>('/notifications/preferences/');
    return response.data;
  },

  async updatePreferences(patch: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const response = await apiClient.patch<NotificationPreferences>('/notifications/preferences/', patch);
    return response.data;
  },
};
