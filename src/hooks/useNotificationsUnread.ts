import { useQuery } from '@tanstack/react-query';
import { notificationsService } from '../api/notifications';

/** Unread row count. Shared `['notifications']` key with the socket hook. */
export function useNotificationsUnread(): number {
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsService.getNotifications,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });
  return (data ?? []).filter((n) => !n.is_read).length;
}

export default useNotificationsUnread;
