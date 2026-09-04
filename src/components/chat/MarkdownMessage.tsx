/**
 * Assistant message renderer.
 *
 * Both chat surfaces (the full-page chat and the docked panel) render assistant
 * markdown with inline citation pills and hover source cards. That renderer was
 * previously copy-pasted between them and had drifted in pill sizing, tooltip
 * width, and link treatment. The `variant` prop carries the intended
 * differences; everything else is shared.
 *
 * This is the single renderer for ALL LLM-produced text shown to the user.
 * Element overrides below (strong, headings, lists, blockquote, table, …) carry
 * their own styling so formatting renders correctly wherever this component is
 * used — even on pages that do not wrap it in a `prose` / `ai-chat-prose`
 * container. Do not render model output with a bare <p> / whitespace-pre-wrap;
 * use this component instead, or raw `**bold**` and `# titles` leak through.
 */

import { memo, useMemo, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, ExternalLink, Globe2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

export interface MarkdownSource {
  url: string;
  title?: string;
}

/** `compact` is the docked side panel; `full` is the main chat column. */
export type MarkdownVariant = 'compact' | 'full';

interface MarkdownMessageProps {
  content: string;
  sources?: MarkdownSource[];
  variant?: MarkdownVariant;
  className?: string;
}

/** Bare `[1]` references become links the citation renderer can pick up. */
const CITATION_PATTERN = /\[(\d+)\]/g;

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'Source';
  }
}

const PILL_STYLES: Record<MarkdownVariant, string> = {
  compact: 'min-w-[18px] h-4 text-[10px]',
  full: 'min-w-[20px] h-5 text-[11px]',
};

const CARD_STYLES: Record<MarkdownVariant, string> = {
  compact: 'max-w-[240px] p-2 rounded-lg gap-1',
  full: 'max-w-[280px] p-2.5 rounded-xl gap-1.5',
};

/**
 * Numbered citation pill with a hover card describing the source.
 *
 * Built from spans, not divs: this renders inside a markdown paragraph, where
 * block-level children are invalid HTML and get reparented by the browser.
 */
function Citation({
  index,
  source,
  variant,
}: {
  index: number;
  source?: MarkdownSource;
  variant: MarkdownVariant;
}) {
  return (
    <span className="relative inline-block group/cit z-20 mx-0.5 align-text-top">
      <a
        href={source?.url || '#'}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          if (!source?.url) e.preventDefault();
        }}
        className={cn(
          'inline-flex items-center justify-center px-1 font-semibold rounded border border-primary/30 no-underline cursor-pointer transition-all bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground shadow-sm',
          PILL_STYLES[variant],
        )}
      >
        {index}
      </a>
      {source && (
        <span
          className={cn(
            'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max bg-zinc-900 border border-zinc-800 shadow-2xl opacity-0 invisible group-hover/cit:opacity-100 group-hover/cit:visible transition-all duration-200 z-50 flex flex-col pointer-events-none',
            CARD_STYLES[variant],
          )}
        >
          <span className="flex items-center gap-1.5 text-zinc-400">
            <Globe2 className="w-3 h-3 shrink-0" />
            <span className="text-[10px] font-semibold truncate">{hostnameOf(source.url)}</span>
          </span>
          <span className="text-[11px] font-medium text-zinc-100 leading-snug line-clamp-2">
            {source.title || source.url}
          </span>
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-0 h-0 border-l-4 border-r-4 border-t-[5px] border-l-transparent border-r-transparent border-t-zinc-800" />
        </span>
      )}
    </span>
  );
}

/** Fenced code block with a language chip and a copy button. */
function CodeBlock({
  language,
  className,
  children,
  ...props
}: {
  language: string;
  className?: string;
  children: ReactNode;
}) {
  const text = String(children).replace(/\n$/, '');

  return (
    <div className="relative group/code my-6 rounded-2xl overflow-hidden border border-border/40 bg-[#0d1117] shadow-xl">
      <div className="flex items-center justify-between px-5 py-3.5 bg-zinc-900/80 border-b border-white/5 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1.5 mr-2">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
          <span className="text-[11px] font-semibold text-zinc-500 uppercase">
            {language || 'CODE'}
          </span>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(text);
            toast.success('Code copied to clipboard');
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all border border-white/5 hover:border-white/20 group/copybtn"
          title="Copy code"
        >
          <Copy className="w-3.5 h-3.5 group-hover/copybtn:scale-110 transition-transform" />
          <span className="text-[11px] font-bold">Copy</span>
        </button>
      </div>
      <div className="relative">
        <pre className="p-6 overflow-x-auto text-[14px] leading-relaxed custom-scrollbar selection:bg-primary/20">
          <code className={cn(className, 'block')} {...props}>
            {children}
          </code>
        </pre>
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none" />
      </div>
    </div>
  );
}

/**
 * Prop types for the react-markdown overrides below.
 *
 * `node` is the mdast node react-markdown hands every override. It was not
 * destructured out of the anchor override, so with `any` it was being spread
 * straight onto the DOM `<a>` — React warns about that at runtime. Naming the
 * props is what made it visible.
 */
type MarkdownNode = { node?: unknown };
type AnchorProps = React.ComponentPropsWithoutRef<'a'> & MarkdownNode;
type ElementProps<T extends keyof React.JSX.IntrinsicElements> =
  React.ComponentPropsWithoutRef<T> & MarkdownNode;
type CodeProps = React.ComponentPropsWithoutRef<'code'> & MarkdownNode & {
  /**
   * react-markdown dropped `inline` in v9 and this project is on v10, so it is
   * always undefined and the branch below turns on the language match alone.
   * Kept because removing it would change which fence renders as a block.
   */
  inline?: boolean;
};

function MarkdownMessage({
  content,
  sources,
  variant = 'full',
  className,
}: MarkdownMessageProps) {
  const components = useMemo(
    () => ({
      a: ({ node: _node, href, children, ...props }: AnchorProps) => {
        if (href?.startsWith('citation:')) {
          const index = parseInt(href.split(':')[1], 10);
          return <Citation index={index} source={sources?.[index - 1]} variant={variant} />;
        }
        if (variant === 'compact') {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
              {...props}
            >
              {children}
            </a>
          );
        }
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mx-0.5 px-2 py-0.5 text-primary font-semibold bg-primary/5 border border-primary/20 rounded-lg no-underline hover:bg-primary/15 hover:border-primary/40 transition-all shadow-sm"
            {...props}
          >
            <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
            {children}
          </a>
        );
      },
      code: ({ node: _node, inline, className: codeClass, children, ...props }: CodeProps) => {
        const match = /language-(\w+)/.exec(codeClass || '');
        if (!inline && match) {
          return (
            <CodeBlock language={match[1].toUpperCase()} className={codeClass} {...props}>
              {children}
            </CodeBlock>
          );
        }
        return (
          <code
            className={cn(
              'px-1.5 py-0.5 rounded-md bg-muted font-mono text-sm border border-border/40 text-primary/90',
              codeClass,
            )}
            {...props}
          >
            {children}
          </code>
        );
      },
      // Self-contained typography: these fire whether or not the caller wrapped
      // this in a `prose` / `ai-chat-prose` container, so bold, titles, lists,
      // quotes and tables look right on every page that shows model output.
      // `node` is stripped in each override for the same reason as the anchor
      // above — it must never reach the DOM.
      strong: ({ node: _node, children, ...props }: ElementProps<'strong'>) => (
        <strong className="font-semibold text-foreground" {...props}>{children}</strong>
      ),
      em: ({ node: _node, children, ...props }: ElementProps<'em'>) => (
        <em {...props}>{children}</em>
      ),
      h1: ({ node: _node, children, ...props }: ElementProps<'h1'>) => (
        <h1 className="text-xl font-semibold mt-6 mb-3 text-foreground leading-tight" {...props}>{children}</h1>
      ),
      h2: ({ node: _node, children, ...props }: ElementProps<'h2'>) => (
        <h2 className="text-lg font-semibold mt-5 mb-2.5 text-foreground leading-tight" {...props}>{children}</h2>
      ),
      h3: ({ node: _node, children, ...props }: ElementProps<'h3'>) => (
        <h3 className="text-[16px] font-semibold mt-4 mb-2 text-foreground leading-snug" {...props}>{children}</h3>
      ),
      h4: ({ node: _node, children, ...props }: ElementProps<'h4'>) => (
        <h4 className="text-[15px] font-semibold mt-3 mb-1.5 text-foreground leading-snug" {...props}>{children}</h4>
      ),
      p: ({ node: _node, children, ...props }: ElementProps<'p'>) => (
        <p className="mb-3 last:mb-0 leading-relaxed" {...props}>{children}</p>
      ),
      ul: ({ node: _node, children, ...props }: ElementProps<'ul'>) => (
        <ul className="list-disc pl-6 mb-3 space-y-1.5 marker:text-primary" {...props}>{children}</ul>
      ),
      ol: ({ node: _node, children, ...props }: ElementProps<'ol'>) => (
        <ol className="list-decimal pl-6 mb-3 space-y-1.5 marker:text-primary marker:font-bold" {...props}>{children}</ol>
      ),
      li: ({ node: _node, children, ...props }: ElementProps<'li'>) => (
        <li className="leading-relaxed [&>p]:mb-1" {...props}>{children}</li>
      ),
      blockquote: ({ node: _node, children, ...props }: ElementProps<'blockquote'>) => (
        <blockquote className="border-l-2 border-primary/40 pl-3 my-3 italic text-muted-foreground" {...props}>{children}</blockquote>
      ),
      table: ({ node: _node, children, ...props }: ElementProps<'table'>) => (
        <span className="block overflow-x-auto my-3 rounded-lg border border-border">
          <table className="w-full border-collapse text-[13px]" {...props}>{children}</table>
        </span>
      ),
      thead: ({ node: _node, children, ...props }: ElementProps<'thead'>) => (
        <thead className="bg-secondary text-left" {...props}>{children}</thead>
      ),
      th: ({ node: _node, children, ...props }: ElementProps<'th'>) => (
        <th className="px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap border-b border-border" {...props}>{children}</th>
      ),
      td: ({ node: _node, children, ...props }: ElementProps<'td'>) => (
        <td className="px-3 py-2 align-top border-b border-border last:border-0 leading-relaxed" {...props}>{children}</td>
      ),
      tr: ({ node: _node, children, ...props }: ElementProps<'tr'>) => (
        <tr {...props}>{children}</tr>
      ),
      hr: ({ node: _node, ...props }: ElementProps<'hr'>) => (
        <hr className="my-4 border-border" {...props} />
      ),
      pre: ({ node: _node, children, ...props }: ElementProps<'pre'>) => (
        <pre className="my-3 overflow-x-auto" {...props}>{children}</pre>
      ),
    }),
    [sources, variant],
  );

  const withCitations = useMemo(
    () => content.replace(CITATION_PATTERN, '[$1](citation:$1)'),
    [content],
  );

  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {withCitations}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Memoised because parsing markdown is not cheap and a transcript re-renders
 * for reasons that have nothing to do with its messages — a status string, a
 * scroll position, a streaming token appended to the *last* bubble. Without
 * this, every already-finished message re-parsed its markdown on each of those.
 *
 * `sources` is compared by identity on purpose: callers pass the array straight
 * off a message object, so a new array means a genuinely different message.
 */
export default memo(MarkdownMessage);
