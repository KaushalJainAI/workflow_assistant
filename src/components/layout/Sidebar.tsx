import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "../../lib/utils";
import {
  CalendarClock,
  GitGraph,
  Key,
  KeyRound,
  Menu,
  Plus,
  FileText,
  MessageCircle,
  Plug,
  Wrench,
  GraduationCap,
  FlaskConical,
  User,
  Activity,
  Radar,
  Bot,
  LayoutGrid,
  Clapperboard,
  // LineChart,  // MVP: unused while Evals is hidden
  // SlidersHorizontal,  // MVP: unused while Tuning is hidden
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useHitlPending } from "../../hooks/useHitlPending";
import { useAuth } from "../../contexts/authState";
import { useImagineOptional } from "../../contexts/imagineState";
import { logsService } from "../../api";
import { toast } from "sonner";



const Sidebar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
    // On mobile: collapsed = fully hidden drawer. On desktop: collapsed = icon rail.
    const [collapsed, setCollapsed] = useState(() => window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (mobile) {
                setCollapsed(true);
            } else {
                setCollapsed(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Auto-close drawer on mobile when route changes
    useEffect(() => {
        if (isMobile) setCollapsed(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname]);

    // Lock body scroll while mobile drawer is open
    useEffect(() => {
        if (isMobile && !collapsed) {
            const prev = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = prev; };
        }
    }, [isMobile, collapsed]);
    const { user, isAuthenticated } = useAuth();
    const isGuest = !isAuthenticated;
    const imagine = useImagineOptional();
    const imaginePending = imagine?.activeCount ?? 0;

    // Badge counts: what is waiting on you (blue count) and what the agent is
    // doing unattended (violet dot). Polled, because the nav outlives any one
    // execution WebSocket.
    // The pending query lives in useHitlPending so that Inbox and Overview,
    // which want the same URL and the same data, share one timer instead of
    // each declaring their own interval over the shared key.
    const { data: pending = [] } = useHitlPending(isAuthenticated);
    const pendingCount = pending.length;
    // No global "something is running" push exists (the execution socket is
    // per-run), so this one genuinely has to poll. A minute is enough for a dot.
    const { data: runningCount = 0 } = useQuery({
        queryKey: ['nav', 'running'],
        enabled: isAuthenticated,
        refetchInterval: 60_000,
        queryFn: async () => {
            const page = await logsService.listExecutions({ status: 'running', limit: 1 });
            return page.results.length;
        },
    });

    // Intercepts clicks on auth-only nav items for guests: show a "log in" toast
    // and route them to /login instead of letting them hit a protected page that
    // would just redirect anyway.
    const guardGuest = (label: string) => (e: React.MouseEvent) => {
        if (isGuest) {
            e.preventDefault();
            toast.info(`Log in to use ${label}`);
            navigate('/login');
        }
    };

    // Generate initials from user name or email
    const getInitials = () => {
        if (user?.name) {
            const parts = user.name.split(' ');
            if (parts.length >= 2) {
                return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            }
            return user.name.slice(0, 2).toUpperCase();
        }
        if (user?.email) {
            return user.email.slice(0, 2).toUpperCase();
        }
        return '??';
    };

    /* The four groups mirror docs/prototype/index.html: what you do today (Work),
       what you build (Build), how you make it better (Improve), and what it runs
       on (Data). `pending` shows a count badge, `agent` a violet activity dot. */
    type NavItem = {
        icon: LucideIcon;
        label: string;
        path: string;
        guestOk?: boolean;   // reachable without logging in
        agent?: boolean;     // show the violet "running unattended" dot
        pending?: boolean;   // show the blue "waiting on you" count
        /** Extra path prefixes this entry should light up for. One entry can
         *  own several routes — Automations covers the agent list, the builder
         *  and both canvases. */
        match?: string[];
    };
    const navGroups: { title: string; items: NavItem[] }[] = [
        {
            title: "Work",
            items: [
                { icon: MessageCircle, label: "Ask", path: "/ai-chat", guestOk: true },
                // Overview now absorbs Inbox functionally — single surface ordered
                // by whether it needs a human (approvals first, then analytics).
                // pending badge moves from Inbox to Overview; Inbox route redirects.
                { icon: Radar, label: "Overview", path: "/overview", pending: true },
                { icon: Activity, label: "Runs", path: "/runs", agent: true },
            ],
        },
        {
            title: "Build",
            items: [
                // Agents and workflows are the same table (`Workflow.kind`)
                // and the same product — an agent decides *whether*, a
                // workflow decides *how*. Automations is the agent list; a
                // workflow canvas is somewhere you open from an agent, not a
                // separate destination. `/workflows` redirects here so old
                // links keep working.
                { icon: Bot, label: "Automations", path: "/agents", match: ["/agents", "/workflow"] },
                // Standard tool library — code-owned tools grouped by grant.
                // Plugins (MCP) bring dynamic mcp__* tools; their catalogue is on
                // Connections, not here. Connectors are credentials (Credentials).
                // Where most agents start — ours to install, and other
                // users' to install or to publish into. A destination
                // rather than a button inside the agent list.
                { icon: LayoutGrid, label: "Explore", path: "/templates" },
                { icon: Wrench, label: "Tools", path: "/tools" },
                // Separate from Automations on purpose: an agent is a
                // configuration, a schedule is a standing commitment to
                // spend on it. The second is worth being able to audit in
                // one place without opening every agent to find it.
                { icon: CalendarClock, label: "Triggers", path: "/schedules" },
                { icon: GraduationCap, label: "Skills", path: "/skills" },
                // Evals sit next to Skills rather than under Runs: a suite is
                // something you author, and its result is only final once a
                // person has answered the review queue.
                { icon: FlaskConical, label: "Evals", path: "/evals" },
                { icon: Clapperboard, label: "Studio", path: "/imagine" },
            ],
        },
        // Plugins vs Connectors vs Tools — unambiguous now:
        // Tools = one callable function the model can invoke (Tools page, code-owned)
        // Plugin = external MCP pack that advertises mcp__* tools at runtime (Connections)
        // Connector = credential/connection info that lets a plugin act as you (Credentials + per-plugin wiring on Connections)
        // Documents holds the file tree that the fileOps tools address via inference/vfs.py.
        {
            title: "Data",
            items: [
                // Connections = Plugins: the MCPServer rows + per-plugin connector wiring.
                // "Data sources" (/connectors) and "Tools" (/mcp-servers) used to be
                // two views of the same tables; they are now one page with clear
                // section headings (Plugins vs Connectors).
                { icon: Plug, label: "Connections", path: "/connections" },
                { icon: KeyRound, label: "Credentials", path: "/credentials" },
                { icon: FileText, label: "Documents", path: "/documents" },
            ],
        },
    ];



    return (
        <>
        {/* Mobile: floating hamburger to open drawer */}
        {isMobile && collapsed && (
            <button
                onClick={() => setCollapsed(false)}
                className="md:hidden fixed top-3 left-3 z-[60] p-2.5 rounded-xl bg-card/90 border border-border/60 backdrop-blur-md shadow-lg active:scale-95 transition-transform"
                aria-label="Open menu"
            >
                <Menu className="w-5 h-5" />
            </button>
        )}

        {/* Mobile: backdrop when drawer is open */}
        {isMobile && !collapsed && (
            <div
                className="md:hidden fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={() => setCollapsed(true)}
            />
        )}

        <div
            className={cn(
                "h-viewport backdrop-blur-xl border-r flex flex-col transition-all duration-300 ease-out overflow-hidden",
                // Mobile: fixed drawer, slides in from left, fully hidden when collapsed
                isMobile
                    ? cn(
                        "fixed left-0 top-0 z-[60] w-72 shadow-2xl",
                        collapsed ? "-translate-x-full" : "translate-x-0"
                      )
                    // Desktop: in-flow, collapses to icon rail
                    : cn(
                        "relative flex-shrink-0 z-50",
                        collapsed ? "w-16" : "w-64"
                      )
            )}
            style={{
                backgroundColor: 'hsl(var(--sidebar-bg))',
                borderColor: 'hsl(var(--sidebar-border))'
            }}
        >
            <div className={cn(
                "p-4 flex items-center border-b transition-all duration-300",
                collapsed ? "justify-center" : "justify-between"
            )} style={{ borderColor: 'hsl(var(--sidebar-border))' }}>
                <div className={cn(
                    "flex items-center gap-2.5 transition-all duration-300 overflow-hidden",
                    collapsed ? "opacity-0 invisible w-0" : "opacity-100 visible w-auto"
                )}>
                    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shadow-sm shrink-0">
                        <GitGraph className="w-4 h-4 text-primary" />
                    </div>
                    <span className="font-bold text-lg tracking-tight text-foreground whitespace-nowrap">AIAAS</span>
                </div>
                <button 
                    onClick={() => setCollapsed(!collapsed)}
                    className="p-1.5 hover:bg-muted rounded-lg transition-colors duration-200 shrink-0"
                >
                    <Menu className="w-5 h-5" />
                </button>
            </div>

            <div className="p-3">
                {/* The primary action is "make a new automation", and an
                    automation is an agent — the deterministic workflow canvas is
                    now something you drop into from an agent, not the thing you
                    start from. */}
                <button
                    onClick={() => {
                        if (isGuest) {
                            toast.info('Log in to create agents');
                            navigate('/login');
                            return;
                        }
                        navigate('/agents/new');
                    }}
                    className={cn(
                        "flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-all duration-200 font-semibold shadow-sm active:scale-[0.98] overflow-hidden whitespace-nowrap mx-auto",
                        collapsed ? "w-10 h-10 p-0" : "w-full py-2.5 px-4 gap-2"
                    )}
                    title={collapsed ? "New agent" : undefined}
                >
                    <Plus className="w-5 h-5 shrink-0" />
                    <span className={cn(
                        "transition-all duration-300 overflow-hidden",
                        collapsed ? "w-0 opacity-0 ml-0" : "w-auto opacity-100 ml-2"
                    )}>
                        New agent
                    </span>
                </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-2 space-y-3">
                {navGroups.map((group) => (
                    <div key={group.title}>
                        <h4 className={cn(
                            "px-3 pb-1 text-[11px] font-semibold text-muted-foreground transition-all duration-300",
                            collapsed ? "h-0 opacity-0 overflow-hidden" : "opacity-100"
                        )}>
                            {group.title}
                        </h4>
                        <div className="space-y-0.5">
                            {group.items.map((item) => {
                                // `match` lets one entry own several routes —
                                // Automations covers /agents and the workflow
                                // canvas, so it stays lit inside either.
                                const prefixes = item.match ?? [item.path];
                                const active = prefixes.some((p) => location.pathname.startsWith(p));
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        onClick={item.guestOk ? undefined : guardGuest(item.label)}
                                        className={cn(
                                            "flex items-center rounded transition-colors group relative py-2",
                                            active
                                                ? "bg-accent text-foreground font-semibold"
                                                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                                            collapsed ? "px-0 justify-center gap-0" : "px-3 justify-start gap-3"
                                        )}
                                        title={collapsed ? item.label : undefined}
                                    >
                                        {/* Fluent uses a left accent stripe, not a filled pill. */}
                                        {active && (
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-primary rounded-r" />
                                        )}
                                        <item.icon className={cn(
                                            "w-[18px] h-[18px] shrink-0",
                                            active && "text-primary"
                                        )} />
                                        <span className={cn(
                                            "text-sm whitespace-nowrap overflow-hidden transition-all duration-300",
                                            collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                                        )}>
                                            {item.label}
                                        </span>
                                        {/* Violet dot = the agent is working unattended.
                                            Blue count = things waiting on you. */}
                                        {!collapsed && item.agent && runningCount > 0 && (
                                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-agent animate-agent-pulse" />
                                        )}
                                        {!collapsed && item.pending && pendingCount > 0 && (
                                            <span className="ml-auto text-[11px] font-semibold px-1.5 rounded bg-primary text-primary-foreground">
                                                {pendingCount}
                                            </span>
                                        )}
                                        {/* Studio: generating count (toby) */}
                                        {!collapsed && item.path === '/imagine' && imaginePending > 0 && (
                                            <span
                                                className="ml-auto flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20"
                                                title={`${imaginePending} generation${imaginePending === 1 ? '' : 's'} in progress`}
                                            >
                                                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                                                {imaginePending}
                                            </span>
                                        )}
                                        {collapsed && item.path === '/imagine' && imaginePending > 0 && (
                                            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary animate-pulse border border-background" />
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Guest call-to-action — unauthenticated visitors */}
            {!isAuthenticated && (
                <div className="p-2 border-t border-border/60 space-y-2">
                    <Link
                        to="/login"
                        className={cn(
                            "flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-semibold transition-all",
                            collapsed ? "w-10 h-10 mx-auto" : "w-full py-2.5 px-3 gap-2"
                        )}
                        title={collapsed ? "Log in" : undefined}
                    >
                        <Key className="w-4 h-4 shrink-0" />
                        <span className={cn("text-sm whitespace-nowrap overflow-hidden", collapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>
                            Log in
                        </span>
                    </Link>
                    {!collapsed && (
                        <p className="text-[11px] text-muted-foreground px-2 leading-snug">
                            Log in to create agents, upload files, and use the assistant.
                        </p>
                    )}
                </div>
            )}

            {/* User Section (auth-only) */}
            {isAuthenticated && <div className="p-2 border-t border-border/60 space-y-1">
                <Link
                    to="/profile"
                    className={cn(
                        "flex items-center rounded-lg transition-all duration-200 group py-1.5",
                        location.pathname === '/profile'
                            ? "bg-muted text-muted-foreground"
                            : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/40",
                        collapsed ? "px-0 justify-center gap-0" : "px-3 justify-start gap-2"
                    )}
                    title={collapsed ? "Profile" : undefined}
                >
                    <User className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className={cn(
                        "text-[11px] font-medium transition-all duration-300 whitespace-nowrap overflow-hidden",
                        collapsed ? "w-0 opacity-0 ml-0" : "w-auto opacity-100 ml-0"
                    )}>
                        Profile
                    </span>
                </Link>
                <Link
                    to="/settings"
                    className={cn(
                        "flex items-center rounded-lg transition-all duration-200 group py-2 overflow-hidden",
                        location.pathname === '/settings' 
                            ? "bg-primary/5 text-primary" 
                            : "hover:bg-muted/60",
                        collapsed ? "px-0 justify-center gap-0" : "px-3 justify-start gap-3"
                    )}
                    title={collapsed ? "Settings" : undefined}
                >
                    <div className="w-8 h-8 flex-shrink-0 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground font-semibold text-sm ring-2 ring-primary/0 group-hover:ring-primary/10 transition-all duration-200">
                        {getInitials()}
                    </div>
                    <div className={cn(
                        "flex-1 min-w-0 transition-all duration-300",
                        collapsed ? "w-0 opacity-0 invisible" : "w-auto opacity-100 visible"
                    )}>
                        <p className="text-sm font-bold text-foreground/90 truncate">{user?.name || 'User'}</p>
                        <p className="text-xs text-muted-foreground truncate">{user?.email || ''}</p>
                    </div>
                </Link>
            </div>}
        </div>
        </>
    );
};

export default Sidebar;
