import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, GitGraph, MoreHorizontal, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { isNavActive, moreNavItems, primaryNav } from '../../lib/navigation';
import { useAuth } from '../../contexts/authState';
import { useHitlPending } from '../../hooks/useHitlPending';
import { logsService, notificationsService } from '../../api';

/* Desktop topbar — the primary navigation surface.
 *
 * Modelled on nidhigrahudyog.com: brand left, primary tabs centre
 * (Ask / Automations / Explore / Activity, like Home / Products / Combos /
 * Offers), account actions right, everything else under "⋯ More". A thin
 * status strip above it (the analogue of their "FREE shipping over ₹499"
 * announcement bar) appears only when something needs you — approvals
 * waiting or runs active — and deep-links to Activity.
 *
 * Rendered `hidden md:flex` by the shell; phones get MobileTopBar instead.
 * Badge queries reuse the sidebar's keys (['hitl-pending'], ['nav','running'],
 * ['notifications']) so the two surfaces share one poll, not two.
 */
export default function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const isGuest = !isAuthenticated;
  const customName = user?.instance_name?.trim();
  const brand = customName && customName !== 'AIAAS Instance' ? customName : 'AIAAS';

  const { data: pending = [] } = useHitlPending(isAuthenticated);
  const pendingCount = pending.length;
  const { data: runningCount = 0 } = useQuery({
    queryKey: ['nav', 'running'],
    enabled: isAuthenticated,
    refetchInterval: 60_000,
    queryFn: async () => {
      const page = await logsService.listExecutions({ status: 'running', limit: 1 });
      return page.results.length;
    },
  });
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    enabled: isAuthenticated,
    refetchInterval: 30_000,
    queryFn: notificationsService.getNotifications,
  });
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const moreActive = moreNavItems.some((item) => isNavActive(location.pathname, item));

  /* Close the More menu on route change — during render keyed on the path,
     not in an effect: the open menu belongs to the route that opened it, so
     a new route means a closed menu by derivation. Escape / outside click
     stay event handlers below. */
  const [menuPath, setMenuPath] = useState(location.pathname);
  if (location.pathname !== menuPath) {
    setMenuPath(location.pathname);
    setMoreOpen(false);
  }
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [moreOpen]);

  const guardGuest = (label: string) => (e: React.MouseEvent) => {
    if (isGuest) {
      e.preventDefault();
      toast.info(`Log in to use ${label}`);
      navigate('/login');
    }
  };

  const initials = (() => {
    if (user?.name) {
      const parts = user.name.split(' ');
      if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      return user.name.slice(0, 2).toUpperCase();
    }
    if (user?.email) return user.email.slice(0, 2).toUpperCase();
    return '??';
  })();

  const showStrip = isAuthenticated && (pendingCount > 0 || runningCount > 0);

  return (
    <header className="hidden md:block border-b bg-card" style={{ borderColor: 'hsl(var(--sidebar-border))' }}>
      {/* Status strip — announcement-bar analogue. Rendered only when there is
          something to say, so it never becomes decoration. */}
      {showStrip && (
        <Link
          to="/runs"
          className="flex h-8 items-center justify-center gap-2 bg-primary-subtle px-4 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          {pendingCount > 0 && <span>{pendingCount} approval{pendingCount === 1 ? '' : 's'} waiting</span>}
          {pendingCount > 0 && runningCount > 0 && <span aria-hidden>·</span>}
          {runningCount > 0 && <span>{runningCount} run{runningCount === 1 ? '' : 's'} active</span>}
        </Link>
      )}
      <div className="flex h-14 items-center gap-4 px-4">
        {/* Brand — left, like the reference logo slot. */}
        <Link to={isGuest ? '/' : '/ai-chat'} className="flex shrink-0 items-center gap-2.5" aria-label={`${brand} home`}>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 shadow-sm">
            <GitGraph className="h-4 w-4 text-primary" />
          </span>
          <span className="max-w-[10rem] truncate text-lg font-bold tracking-tight" title={brand}>
            {brand}
          </span>
        </Link>

        {/* Primary tabs — centre. */}
        <nav aria-label="Primary" className="flex min-w-0 flex-1 items-center justify-center gap-1">
          {primaryNav.map((item) => {
            const active = isNavActive(location.pathname, item);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={item.guestOk ? undefined : guardGuest(item.label)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors',
                  active
                    ? 'font-semibold text-foreground'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                <item.icon className={cn('h-4 w-4', active && 'text-primary')} />
                {item.label}
                {!isGuest && item.agent && runningCount > 0 && (
                  <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-agent animate-agent-pulse" aria-label="Runs active" />
                )}
                {!isGuest && item.pending && pendingCount > 0 && (
                  <span className="ml-0.5 rounded bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                    {pendingCount}
                  </span>
                )}
                {active && <span className="absolute inset-x-2 -bottom-[9px] h-[2px] rounded-full bg-primary" />}
              </Link>
            );
          })}
          {/* Overflow — the reference site's "⋯ More". */}
          <div ref={moreRef} className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors',
                moreActive || moreOpen
                  ? 'font-semibold text-foreground'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              <MoreHorizontal className="h-4 w-4" />
              More
            </button>
            {moreOpen && (
              <div
                role="menu"
                className="absolute left-1/2 top-full z-50 mt-2 w-60 -translate-x-1/2 rounded-lg border border-border bg-popover p-1.5 shadow-lg animate-in fade-in zoom-in-95 duration-150"
              >
                {moreNavItems.map((item) => {
                  const active = isNavActive(location.pathname, item);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      role="menuitem"
                      onClick={guardGuest(item.label)}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                        active
                          ? 'bg-accent font-semibold text-foreground'
                          : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                      )}
                    >
                      <item.icon className={cn('h-4 w-4 shrink-0', active && 'text-primary')} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Actions — right, like the reference language / wishlist / account / cart icons. */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(isGuest ? '/' : '/ai-chat', { state: { newChat: true } })}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New chat
          </button>
          {isAuthenticated ? (
            <>
              <Link
                to="/settings"
                aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
                className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <Bell className="h-[18px] w-[18px]" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-background bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              <Link
                to="/profile"
                aria-label="Profile and settings"
                title={user?.email ?? 'Profile'}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-muted text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                {initials}
              </Link>
            </>
          ) : (
            <Link
              to="/login"
              className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Log in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
