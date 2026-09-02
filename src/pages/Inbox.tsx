/**
 * Inbox — everything the agent has stopped and asked you about.
 *
 * This is the screen the "ask first" safety model depends on: if a workflow is
 * set to pause before a side effect, the request lands here and nothing leaves
 * the account until someone answers. Previously these only appeared as a card
 * inside Orchestrator, which meant you had to already be looking to find them.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useHitlPending } from '../hooks/useHitlPending';
import { Link } from 'react-router-dom';
import {
  Inbox as InboxIcon,
  ShieldQuestion,
  HelpCircle,
  AlertTriangle,
  Clock,
  Check,
  X,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { orchestratorService, type HITLRequest } from '../api';
import { cn } from '../lib/utils';
import PageHeader from '../components/layout/PageHeader';
import ExtractionPanel from '../components/extraction/ExtractionPanel';

const typeConfig = {
  approval: { icon: ShieldQuestion, label: 'Needs your approval' },
  clarification: { icon: HelpCircle, label: 'Needs an answer' },
  error: { icon: AlertTriangle, label: 'Failed — needs a decision' },
} as const;

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** A request expires if nobody answers; show how long is left, not a raw stamp. */
function timeLeft(req: HITLRequest) {
  if (!req.timeout_seconds) return null;
  const deadline = new Date(req.created_at).getTime() + req.timeout_seconds * 1000;
  const mins = Math.floor((deadline - Date.now()) / 60000);
  if (mins <= 0) return 'expired';
  if (mins < 60) return `${mins}m left`;
  return `${Math.floor(mins / 60)}h left`;
}

export default function Inbox() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'approvals' | 'extraction'>('approvals');

  const { data: requests = [], isLoading } = useHitlPending();

  const respond = useMutation({
    mutationFn: ({ id, action, response }: { id: string; action: 'approve' | 'reject' | 'respond'; response?: string }) =>
      orchestratorService.respondToHITL(id, { action, response }),
    onSuccess: () => {
      toast.success('Response sent');
      setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ['hitl'] });
      queryClient.invalidateQueries({ queryKey: ['nav'] });
    },
    onError: () => toast.error('Could not send that response'),
  });

  // Land on the oldest request rather than an empty pane — the queue is the
  // point of the screen, so there is always something to act on.
  const selected =
    requests.find((r) => r.request_id === selectedId) ?? requests[0] ?? null;

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        icon={InboxIcon}
        title="Inbox"
        subtitle={
          requests.length
            ? `${requests.length} ${requests.length === 1 ? 'request needs' : 'requests need'} your attention`
            : 'Nothing is waiting on you'
        }
      >
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTab('approvals')}
            className={cn(
              "px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors border-b-2",
              tab === 'approvals'
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            Approvals {requests.length > 0 && `(${requests.length})`}
          </button>
          <button
            onClick={() => setTab('extraction')}
            className={cn(
              "px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors border-b-2",
              tab === 'extraction'
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            Documents to review
          </button>
        </div>
      </PageHeader>

      {tab === 'extraction' ? (
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <ExtractionPanel mode="review" />
        </div>
      ) : isLoading ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="w-12 h-12 rounded-lg bg-secondary border border-border flex items-center justify-center mb-4">
            <Check className="w-6 h-6 text-success" />
          </div>
          <h3 className="text-lg font-semibold mb-1">You're clear</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            When an agent reaches a step it isn't allowed to take on its own, it stops
            and asks here. Nothing is pending.
          </p>
          <Link to="/runs" className="mt-4 text-sm text-primary hover:underline">
            See what has been running
          </Link>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0">
          {/* Queue */}
          <div className="w-full lg:w-[420px] border-r border-border overflow-y-auto">
            {requests.map((req) => {
              const cfg = typeConfig[req.request_type] ?? typeConfig.approval;
              const Icon = cfg.icon;
              const isError = req.request_type === 'error';
              const active = req.request_id === selectedId;
              return (
                <button
                  key={req.request_id}
                  onClick={() => setSelectedId(req.request_id)}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b border-border transition-colors relative',
                    active ? 'bg-primary-subtle' : 'hover:bg-secondary'
                  )}
                >
                  {/* Left stripe: blue = your turn, red = it broke. */}
                  <span
                    className={cn(
                      'absolute left-0 top-0 bottom-0 w-[3px]',
                      isError ? 'bg-destructive' : 'bg-primary'
                    )}
                  />
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={cn('w-4 h-4', isError ? 'text-destructive' : 'text-primary')} />
                    <span className={cn('text-[13px] font-semibold', isError ? 'text-destructive' : 'text-primary')}>
                      {cfg.label}
                    </span>
                    <span className="ml-auto text-[11px] text-muted-foreground">{timeAgo(req.created_at)}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">{req.title}</p>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    {req.workflow_name && <span className="truncate">{req.workflow_name}</span>}
                    {timeLeft(req) && (
                      <span className="flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3" />
                        {timeLeft(req)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail */}
          <div className="hidden lg:flex flex-1 flex-col overflow-y-auto">
            {!selected ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Pick a request to see what the agent wants to do
              </div>
            ) : (
              <div className="p-6 max-w-2xl">
                <h2 className="text-xl font-semibold mb-2">{selected.title}</h2>
                {selected.workflow_name && (
                  <p className="text-sm text-muted-foreground mb-4 flex items-center gap-1">
                    {selected.workflow_name}
                    <ChevronRight className="w-3 h-3" />
                    step {selected.node_id}
                  </p>
                )}

                <div className="bg-card border border-border rounded p-4 mb-5">
                  <p className="text-[15px] leading-relaxed text-foreground whitespace-pre-wrap">
                    {selected.message}
                  </p>
                </div>

                {/* The backend supplies the wording of each choice, so the
                    buttons say what will actually happen. */}
                <div className="flex flex-wrap gap-2">
                  {(selected.options?.length ? selected.options : ['Approve', 'Reject']).map((opt, i) => (
                    <button
                      key={opt}
                      disabled={respond.isPending}
                      onClick={() =>
                        respond.mutate({
                          id: selected.request_id,
                          action: i === 0 ? 'approve' : 'respond',
                          response: opt,
                        })
                      }
                      className={cn(
                        'px-4 py-2 text-sm rounded border transition-colors disabled:opacity-50',
                        i === 0
                          ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90 font-semibold'
                          : 'bg-card border-border hover:bg-secondary'
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                  <button
                    disabled={respond.isPending}
                    onClick={() => respond.mutate({ id: selected.request_id, action: 'reject' })}
                    className="px-4 py-2 text-sm rounded border border-border hover:bg-secondary text-muted-foreground flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    Stop this run
                  </button>
                </div>

                <p className="text-[12px] text-muted-foreground mt-4">
                  Nothing has left your account. This step runs only after you answer.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
