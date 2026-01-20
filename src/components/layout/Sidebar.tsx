import { Link, useLocation } from "react-router-dom";
import { cn } from "../../lib/utils";
import { 
  GitGraph, 
  Settings, 
  Key, 
  Play, 
  Menu,
  Plus,
  FileText,
  Sparkles,
  CreditCard,
  BarChart3,
  Brain
} from "lucide-react";
import { useState } from "react";

interface SidebarProps {
  onAIBuilderClick?: () => void;
  aiPanelOpen?: boolean;
}

const Sidebar = ({ onAIBuilderClick, aiPanelOpen }: SidebarProps) => {
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(false);

    const navItems = [
        { icon: GitGraph, label: "Workflows", path: "/workflows" },
        { icon: Play, label: "Executions", path: "/executions" },
        { icon: Brain, label: "Orchestrator", path: "/orchestrator" },
        { icon: BarChart3, label: "Insights", path: "/insights" },
        { icon: FileText, label: "Documents", path: "/documents" },
        { icon: Key, label: "Credentials", path: "/credentials" },
        { icon: CreditCard, label: "Billing", path: "/billing" },
        { icon: Settings, label: "Settings", path: "/settings" },
    ];

    return (
        <div className={cn(
            "h-screen bg-card border-r border-border flex flex-col transition-all duration-300",
            collapsed ? "w-16" : "w-64"
        )}>
            <div className="p-4 flex items-center justify-between border-b border-border">
                {!collapsed && (
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center">
                            <GitGraph className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold text-xl">Nexus</span>
                    </div>
                )}
                <button 
                    onClick={() => setCollapsed(!collapsed)}
                    className="p-1.5 hover:bg-muted rounded-md"
                >
                    <Menu className="w-5 h-5" />
                </button>
            </div>

            <div className="p-3">
                <Link 
                    to="/workflows/new"
                    className={cn(
                        "w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 py-2.5 rounded-lg transition-all font-medium",
                        collapsed ? "px-0" : "px-4"
                    )}
                >
                    <Plus className="w-5 h-5" />
                    {!collapsed && <span>New Workflow</span>}
                </Link>
            </div>

            <nav className="flex-1 p-2 space-y-1">
                {navItems.map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                            location.pathname.startsWith(item.path) 
                                ? "bg-accent text-accent-foreground font-medium" 
                                : "text-muted-foreground hover:bg-muted hover:text-foreground",
                            collapsed && "justify-center"
                        )}
                        title={collapsed ? item.label : undefined}
                    >
                        <item.icon className="w-5 h-5" />
                        {!collapsed && <span>{item.label}</span>}
                    </Link>
                ))}
            </nav>

            {/* AI Builder Button */}
            <div className="p-2">
                <button
                    onClick={onAIBuilderClick}
                    className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                        aiPanelOpen 
                            ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium" 
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        collapsed && "justify-center"
                    )}
                    title={collapsed ? "AI Builder" : undefined}
                >
                    <Sparkles className="w-5 h-5" />
                    {!collapsed && <span>AI Builder</span>}
                </button>
            </div>

            {/* User Section */}
            <div className="p-3 border-t border-border">
                <div className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted cursor-pointer",
                    collapsed && "justify-center"
                )}>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white font-medium text-sm">
                        JD
                    </div>
                    {!collapsed && (
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">John Doe</p>
                            <p className="text-xs text-muted-foreground truncate">john@example.com</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
