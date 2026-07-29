import { asArray } from './unwrap';
import apiClient from './client';

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  data: any;
  is_read: boolean;
  created_at: string;
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
  }
};
