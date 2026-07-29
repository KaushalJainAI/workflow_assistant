import { useState, useEffect } from 'react';
import { Bell, CheckCircle, Clock, ShieldAlert, AlertTriangle, Info } from 'lucide-react';
import { notificationsService, type Notification } from '../../api/notifications';
import { cn } from '../../lib/utils';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationsTab() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const data = await notificationsService.getNotifications();
      setNotifications(data);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      await notificationsService.markAsRead(id);
      setNotifications(notifications.map(n => 
        n.id === id ? { ...n, is_read: true } : n
      ));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsService.markAllAsRead();
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'workflow_failed': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'hitl_request': return <ShieldAlert className="w-5 h-5 text-amber-500" />;
      case 'image_ready': return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'new_message': return <Bell className="w-5 h-5 text-blue-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-medium">Notifications</h3>
          <p className="text-sm text-muted-foreground mt-1">Manage your platform alerts and updates.</p>
        </div>
        {unreadCount > 0 && (
          <button 
            onClick={handleMarkAllAsRead}
            className="text-sm text-primary hover:underline font-medium"
          >
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border/60 rounded-xl bg-card/30">
          <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground font-medium">No notifications yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Nothing new</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div 
              key={notification.id} 
              className={cn(
                "p-4 rounded-xl border transition-all flex gap-4 items-start",
                notification.is_read 
                  ? "bg-card/30 border-border/40 opacity-70" 
                  : "bg-card/80 border-primary/20 shadow-sm"
              )}
            >
              <div className="mt-1 shrink-0 p-2 bg-background rounded-full border border-border/50">
                {getIcon(notification.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <h4 className={cn("text-sm font-semibold truncate", !notification.is_read && "text-foreground")}>
                    {notification.title}
                  </h4>
                  <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {notification.message}
                </p>
                {notification.data && Object.keys(notification.data).length > 0 && (
                  <pre className="mt-3 p-2 bg-muted/50 rounded-lg text-xs font-mono text-muted-foreground overflow-x-auto border border-border/50">
                    {JSON.stringify(notification.data, null, 2)}
                  </pre>
                )}
                
                {!notification.is_read && (
                  <div className="mt-3 flex">
                    <button 
                      onClick={() => handleMarkAsRead(notification.id)}
                      className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      Mark as read
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
