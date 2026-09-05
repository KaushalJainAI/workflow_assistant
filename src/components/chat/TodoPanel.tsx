import { Check, CircleDashed, Loader2, Ban } from 'lucide-react';
import type { TodoItem } from '../../api/chat';

/**
 * The plan an agent is working to, as it works to it.
 *
 * The list exists so a long run does not forget its own goal — curation folds
 * the oldest messages away, and the original instruction is the first thing to
 * go, so the plan lives in graph state instead of the transcript. That is a
 * backend property; this is the half that makes it worth having for the
 * *person* watching, who otherwise sees forty tool calls and no thread.
 *
 * Progress is shown as a count and a bar rather than as prose, because the only
 * question a reader has mid-run is "how much is left". Blocked items are kept
 * visible and styled distinctly: they are the ones the final answer has to
 * account for, and hiding them would make a partial result look complete.
 */

interface Props {
  todos: TodoItem[];
  /** Live runs get a subtler frame; a finished turn's plan is a record. */
  live?: boolean;
}

const ICONS = {
  done: Check,
  doing: Loader2,
  blocked: Ban,
  open: CircleDashed,
} as const;

export default function TodoPanel({ todos, live = false }: Props) {
  if (!todos?.length) return null;

  const done = todos.filter(t => t.status === 'done').length;
  const blocked = todos.filter(t => t.status === 'blocked').length;
  const pct = Math.round((done / todos.length) * 100);

  return (
    <div
      className={`my-3 overflow-hidden rounded-xl border bg-muted/20 ${
        live ? 'border-primary/30' : 'border-border/60'
      }`}
    >
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-3 py-1.5">
        <span className="text-[11px] font-medium text-muted-foreground">Plan</span>
        <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
          {done}/{todos.length} done{blocked ? ` · ${blocked} blocked` : ''}
        </span>
      </div>

      {/* One bar, one number, same scale — the bar is the count, not a mood. */}
      <div className="h-0.5 w-full bg-muted">
        <div
          className="h-full bg-primary transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="m-0 list-none space-y-0.5 p-2">
        {todos.map((todo, i) => {
          const Icon = ICONS[todo.status] ?? CircleDashed;
          return (
            <li
              key={`${i}-${todo.text}`}
              className="flex items-start gap-2 rounded px-1.5 py-1 text-[12px] leading-snug"
            >
              <Icon
                className={`mt-0.5 h-3 w-3 shrink-0 ${
                  todo.status === 'done' ? 'text-emerald-500'
                    : todo.status === 'doing' ? 'animate-spin text-primary'
                    : todo.status === 'blocked' ? 'text-amber-500'
                    : 'text-muted-foreground/50'
                }`}
              />
              <span
                className={
                  todo.status === 'done' ? 'text-muted-foreground line-through decoration-muted-foreground/40'
                    : todo.status === 'blocked' ? 'text-muted-foreground'
                    : 'text-foreground'
                }
              >
                {todo.text}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
