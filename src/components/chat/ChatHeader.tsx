/**
 * The bar at the top of the chat page: history button, memory-off warning,
 * the conversation's running cost, and the chat-settings button.
 */
import { BrainCircuit, Coins, History, Settings2, Shield } from 'lucide-react';

import type { ChatSession } from '../../api';
import { costQualifier, describeConversationCost, formatCost } from '../../lib/cost';
import { cn } from '../../lib/utils';
import SidebarMenuButton from '../layout/SidebarMenuButton';

interface ChatHeaderProps {
  isGuest: boolean;
  /** When the history drawer is open its own header has a close button, so ours hides. */
  historyOpen: boolean;
  onOpenHistory: () => void;
  session: ChatSession | null;
  /** The "Memory off" chip: opens the settings dialog as it is. */
  onShowSettings: () => void;
  /** The gear button: resets the prompt draft to the saved one, then opens the dialog. */
  onEditSettings: () => void;
}

export default function ChatHeader({
  isGuest,
  historyOpen,
  onOpenHistory,
  session,
  onShowSettings,
  onEditSettings,
}: ChatHeaderProps) {
  return (
    <header className={cn(
      "h-16 shrink-0 flex items-center px-4 md:px-6 justify-between border-b border-border/40 bg-background/50",
      // Guest: the banner band overlays the top — push the header below
      // it instead of stretching it.
      isGuest && "mt-14 md:mt-10"
    )}>
      <div className="flex items-center gap-3 min-w-0">
        {!isGuest && <SidebarMenuButton />}
        {!historyOpen && (
          <button
            onClick={onOpenHistory}
            className="p-2.5 md:p-3 bg-card/40 border border-border/60 hover:bg-card/60 rounded-lg transition-colors text-muted-foreground group shrink-0"
            aria-label="Conversation history"
          >
            <History className="w-5 h-5 group-hover:text-primary transition-colors" />
          </button>
        )}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded border border-border bg-secondary">
           <div className="w-1.5 h-1.5 rounded-full bg-success" />
           <span className="text-[11px] font-semibold text-muted-foreground">Assistant online</span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
         {/* Memory state is shown in the header, not buried in the panel:
             with it off the assistant behaves very differently, and a user
             who forgot they switched it off reads that as the model being
             broken. */}
         {!isGuest && session && !session.memory_enabled && (
           <button
             onClick={onShowSettings}
             title="Memory is off for this chat — click to change"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-500/40
                         bg-warning-subtle text-[11px] font-semibold text-amber-500
                         transition-colors duration-200 hover:bg-amber-500/20
                         animate-in fade-in slide-in-from-right-2 shrink-0"
           >
             <BrainCircuit className="w-3.5 h-3.5" />
             Memory off
           </button>
         )}
         {/* What this conversation has cost so far. In the header, not the
             settings panel, so it is noticed while the conversation is still
             growing. Hidden until there is a figure: "—" on every new chat
             would be noise. */}
         {session && session.cost_source
           && session.cost_source !== 'unpriced' && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-muted-foreground tabular-nums shrink-0"
              title={describeConversationCost(
                session.total_cost_usd, session.cost_source,
                session.total_tokens_used ?? 0,
                session.paid_by ?? '',
              )}
            >
              <Coins className="w-3.5 h-3.5" />
              {formatCost(session.total_cost_usd, session.cost_source)}
              {/* Never a bare figure: whether it was charged or estimated
                  is half of what the number means. The qualifier hides on
                  phones where the header is crowded. */}
              <span className="hidden sm:inline font-normal opacity-80">
                {costQualifier(session.cost_source)}
              </span>
            </div>
         )}
         <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <Shield className="w-3.5 h-3.5" />
            Encrypted
         </div>
         {session && (
           <button
             onClick={onEditSettings}
             title="Chat settings"
             className="p-1.5 rounded-lg text-muted-foreground transition-colors duration-200
                        hover:bg-muted hover:text-foreground active:scale-95"
           >
             <Settings2 className="w-4 h-4" />
           </button>
         )}
      </div>
    </header>
  );
}
