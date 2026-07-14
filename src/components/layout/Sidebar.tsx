import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "../../lib/utils";
import {
  GitGraph,
  Key,
  Menu,
  Plus,
  FileText,
  Sparkles,
  Brain,
  Layout,
  Loader2,
  Code2,
  Plug,
  Wrench,
  User,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { workflowsService } from "../../api";
import { toast } from "sonner";



const Sidebar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
    // On mobile: collapsed = fully hidden drawer. On desktop: collapsed = icon rail.
    const [collapsed, setCollapsed] = useState(() => window.innerWidth < 768);
    const [isCreating, setIsCreating] = useState(false);

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

    // Core workspace navigation — the primary surfaces.
    const navItems = [
        { icon: GitGraph, label: "Workflows", path: "/workflows" },
        { icon: Layout, label: "Templates", path: "/templates" },
        { icon: FileText, label: "Documents", path: "/documents" },
        { icon: Key, label: "Credentials", path: "/credentials" },
    ];

    // Setup-heavy / power-user surfaces. De-emphasised, but must stay reachable
    // from the UI (previously these pages had no nav entry at all).
    const devItems = [
        { icon: Plug, label: "Connectors", path: "/connectors" },
        { icon: Wrench, label: "Skills", path: "/skills" },
        { icon: Code2, label: "MCP Servers", path: "/mcp-servers" },
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

            {/* AI Prominent Section */}
            <div className="p-2 border-b border-border/40 space-y-1">
                {/* AI Chat Link */}
                <Link
                    to="/ai-chat"
                    className={cn(
                        "w-full flex items-center rounded-lg transition-all duration-200 group py-2.5",
                        location.pathname === '/ai-chat'
                            ? "bg-primary/10 text-primary font-bold shadow-sm" 
                            : "text-muted-foreground hover:bg-primary/5 hover:text-foreground",
                        collapsed ? "px-0 justify-center gap-0" : "px-3 justify-start gap-3"
                    )}
                    title={collapsed ? "AI Chat" : undefined}
                >
                    <Sparkles className={cn(
                        "w-5 h-5 flex-shrink-0 transition-transform duration-200 text-primary",
                        location.pathname !== '/ai-chat' && "group-hover:scale-110"
                    )} />
                    <span className={cn(
                        "text-sm font-medium transition-all duration-300 whitespace-nowrap overflow-hidden",
                        collapsed ? "w-0 opacity-0 ml-0" : "w-auto opacity-100 ml-0"
                    )}>
                        AI Chat
                    </span>
                </Link>

                {/* Imagine Link - New Position */}
                <Link
                    to="/imagine"
                    onClick={guardGuest('Imagine')}
                    className={cn(
                        "w-full flex items-center rounded-lg transition-all duration-200 group py-2.5",
                        location.pathname === '/imagine'
                            ? "bg-primary/10 text-primary font-bold shadow-sm" 
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        collapsed ? "px-0 justify-center gap-0" : "px-3 justify-start gap-3"
                    )}
                    title={collapsed ? "Imagine" : undefined}
                >
                    <Sparkles className={cn(
                        "w-5 h-5 flex-shrink-0 transition-transform duration-200 text-primary",
                        location.pathname !== '/imagine' && "group-hover:scale-110"
                    )} />
                    <span className={cn(
                        "text-sm font-medium transition-all duration-300 whitespace-nowrap overflow-hidden",
                        collapsed ? "w-0 opacity-0 ml-0" : "w-auto opacity-100 ml-0"
                    )}>
                        Imagine
                    </span>
                </Link>

                {/* Orchestrator Link - Relocated & Highlighted */}
                <Link
                    to="/orchestrator"
                    onClick={guardGuest('Orchestrator')}
                    className={cn(
                        "w-full flex items-center rounded-lg transition-all duration-200 group py-2.5",
                        location.pathname === '/orchestrator'
                            ? "bg-primary/10 text-primary font-bold shadow-sm" 
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        collapsed ? "px-0 justify-center gap-0" : "px-3 justify-start gap-3"
                    )}
                    title={collapsed ? "Orchestrator" : undefined}
                >
                    <Brain className={cn(
                        "w-5 h-5 flex-shrink-0 transition-transform duration-200 text-primary",
                        location.pathname !== '/orchestrator' && "group-hover:scale-110"
                    )} />
                    <span className={cn(
                        "text-sm font-medium transition-all duration-300 whitespace-nowrap overflow-hidden",
                        collapsed ? "w-0 opacity-0 ml-0" : "w-auto opacity-100 ml-0"
                    )}>
                        Orchestrator
                    </span>
                </Link>

            </div>

            <div className="p-3">
                <button
                    onClick={async () => {
                        if (isGuest) {
                            toast.info('Log in to create workflows');
                            navigate('/login');
                            return;
                        }
                        try {
                            setIsCreating(true);
                            const newWorkflow = await workflowsService.create({
                                name: 'Untitled Workflow',
                                description: 'A new empty workflow',
                                status: 'draft',
                                nodes: [],
                                edges: []
                            });
                            navigate(`/workflow/${newWorkflow.id}`);
                        } catch (error) {
                            console.error('Failed to create workflow:', error);
                            toast.error('Failed to create new workflow');
                        } finally {
                            setIsCreating(false);
                        }
                    }}
                    disabled={isCreating}
                    className={cn(
                        "flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-all duration-200 font-semibold shadow-sm active:scale-[0.98] overflow-hidden whitespace-nowrap mx-auto",
                        collapsed ? "w-10 h-10 p-0" : "w-full py-2.5 px-4 gap-2"
                    )}
                    title={collapsed ? "New Workflow" : undefined}
                >
                    {isCreating ? (
                        <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                    ) : (
                        <Plus className="w-5 h-5 shrink-0" />
                    )}
                    <span className={cn(
                        "transition-all duration-300 overflow-hidden",
                        collapsed ? "w-0 opacity-0 ml-0" : "w-auto opacity-100 ml-2"
                    )}>
                        {isCreating ? 'Creating...' : 'New Workflow'}
                    </span>
                </button>
            </div>

            <nav className="flex-1 p-2 space-y-0.5">
                {navItems.map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        onClick={guardGuest(item.label)}
                        className={cn(
                            "flex items-center rounded-lg transition-all duration-200 group relative py-2.5",
                            location.pathname.startsWith(item.path) 
                                ? "bg-primary/10 text-primary font-bold shadow-sm" 
                                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                            collapsed ? "px-0 justify-center gap-0" : "px-3 justify-start gap-3"
                        )}
                        title={collapsed ? item.label : undefined}
                    >
                        {location.pathname.startsWith(item.path) && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                        )}
                        <item.icon className={cn(
                            "w-5 h-5 transition-transform duration-200 shrink-0",
                            !location.pathname.startsWith(item.path) && "group-hover:scale-110"
                        )} />
                        <span className={cn(
                            "text-sm transition-all duration-300 whitespace-nowrap overflow-hidden",
                            collapsed ? "w-0 opacity-0 ml-0" : "w-auto opacity-100 ml-0"
                        )}>
                            {item.label}
                        </span>
                    </Link>
                ))}
            </nav>

            {/* Developer section — de-emphasised, for power users */}
            <div className="px-2 pt-2 pb-1 border-t border-border/30 space-y-0.5">
                {devItems.map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        onClick={guardGuest(item.label)}
                        className={cn(
                            "flex items-center rounded-lg transition-all duration-200 group py-1.5",
                            location.pathname === item.path
                                ? "bg-muted text-muted-foreground"
                                : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40",
                            collapsed ? "px-0 justify-center gap-0" : "px-3 justify-start gap-2"
                        )}
                        title={collapsed ? `Developer: ${item.label}` : undefined}
                    >
                        <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className={cn(
                            "text-[11px] font-medium transition-all duration-300 whitespace-nowrap overflow-hidden",
                            collapsed ? "w-0 opacity-0 ml-0" : "w-auto opacity-100 ml-0"
                        )}>
                            {item.label}
                        </span>
                    </Link>
                ))}
            </div>

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
                            Log in for workflows, uploads, KB, MCP, and the help agent.
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
