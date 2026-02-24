import ChatPanel from './ChatPanel';
import { useAssistant } from '../../contexts/AssistantContext';
import { cn } from '../../lib/utils';

export default function GlobalAssistantPanel() {
  const { isAssistantOpen, closeAssistant } = useAssistant();

  if (!isAssistantOpen) return null;

  return (
    <div className={cn(
      "w-[320px] border-l border-border bg-card shadow-xl z-[100] flex flex-col transition-all duration-300 shrink-0 h-full",
      isAssistantOpen ? "translate-x-0" : "translate-x-full"
    )}>
      <ChatPanel 
        isDocked={true} 
        onClose={closeAssistant} 
      />
    </div>
  );
}
