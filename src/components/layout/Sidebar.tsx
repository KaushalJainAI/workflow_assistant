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
  Zap
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { workflowsService } from "../../api";
import { toast } from "sonner";



const Sidebar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const { user } = useAuth();

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

    const navItems = [
        { icon: GitGraph, label: "Workflows", path: "/workflows" },
        { icon: Key, label: "Credentials", path: "/credentials" },
        { icon: Zap, label: "Skills", path: "/skills" },
        { icon: Layout, label: "Templates", path: "/templates" },
        { icon: FileText, label: "Documents", path: "/documents" },
    ];



    return (
        <div 
            className={cn(
                "h-screen backdrop-blur-xl border-r flex flex-col transition-all duration-300 ease-out relative z-40 overflow-hidden",
                collapsed ? "w-16" : "w-56"
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
                    <span className="font-bold text-lg tracking-tight text-foreground whitespace-nowrap">AstraFlow</span>
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

            {/* User Section */}
            <div className="p-2 border-t border-border/60 mt-auto">
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
            </div>
        </div>
    );
};

export default Sidebar;
