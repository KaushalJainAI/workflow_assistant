/**
 * Agent view — describe the media, the router picks parameters, HITL confirms.
 *
 * Layout notes, because the previous version got each of these wrong:
 *
 * - **One header.** The page already says "Imagine" with a palette icon; this used
 *   to add a second bar saying "Imagine agent" with the same icon directly
 *   beneath it.
 * - **Connection state is only shown when it is bad.** A permanent green
 *   "live" pill spends real estate telling the user nothing is wrong. It now
 *   appears only when the socket drops.
 * - **The empty state is a hero, not a void.** Composer, greeting and starters
 *   sit together in the middle of the screen; previously the greeting floated
 *   at the centre while the composer was pinned ~600px below it with nothing
 *   in between. Once a conversation starts the composer docks to the bottom.
 * - **Everything shares one measure.** The composer used to span the full
 *   viewport while the content above it was capped at ~640px, so on a wide
 *   monitor the caret sat at the far left and the send button at the far right.
 *
 * The composer carries the modality selector and model picker, which default
 * to **Auto** — say what you want and let the router choose.
 */
import { useEffect, useRef, useState } from 'react';
import { Headphones, ImageIcon, Palette, Video, WifiOff } from 'lucide-react';
import { useImagineAgent } from '../../hooks/useImagineAgent';
import { usePersistedState } from '../../hooks/usePersistedState';
import type { Capabilities, MediaKind } from '../../api/imagine';
import { IntentPreviewCard } from './IntentPreviewCard';
import { GenerationBubble } from './GenerationBubble';
import { Lightbox, type LightboxItem } from './Lightbox';
import { ModelPicker } from './ModelPicker';
import { SendButton } from '../ui/SendButton';
import { cn } from '../../lib/utils';

/** `auto` leaves the modality to the router. */
type KindChoice = 'auto' | MediaKind;

const KIND_OPTIONS: Array<{ id: KindChoice; icon?: typeof ImageIcon; label: string }> = [
  { id: 'auto', label: 'Auto' },
  { id: 'image', icon: ImageIcon, label: 'Image' },
  { id: 'video', icon: Video, label: 'Video' },
  { id: 'audio', icon: Headphones, label: 'Audio' },
];

const STARTERS: Array<{ kind: MediaKind; text: string }> = [
  { kind: 'image', text: 'A neon-lit Tokyo street at night, reflections on wet asphalt' },
  { kind: 'image', text: 'Watercolour fox curled asleep in a forest, soft light' },
  { kind: 'video', text: 'A 6-second aerial clip over snowy mountains at golden hour' },
  { kind: 'audio', text: 'Narrate calmly: "Welcome to the future of media."' },
];

const STARTER_ICON: Record<MediaKind, typeof ImageIcon> = {
  image: ImageIcon,
  video: Video,
  audio: Headphones,
};

interface Props {
  capabilities: Capabilities | null;
  onRefreshCatalog?: () => void;
  isRefreshingCatalog?: boolean;
}

export function ImagineChat({ capabilities, onRefreshCatalog, isRefreshingCatalog }: Props) {
  const { items, isSending, isConnected, pendingIntent, sendMessage, resume } = useImagineAgent();
  const [draft, setDraft] = useState('');
  const [lightbox, setLightbox] = useState<LightboxItem | null>(null);
  const [kind, setKind] = usePersistedState<KindChoice>('imagine.agentKind', 'auto');
  const [modelByKind, setModelByKind] = usePersistedState<Partial<Record<MediaKind, string>>>(
    'imagine.agentModelByKind',
    {},
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  const pinnedModel = kind === 'auto' ? null : modelByKind[kind] ?? null;
  const isEmpty = items.length === 0;

  // Adopt the backend default when a modality is chosen but no model is yet.
  useEffect(() => {
    if (kind === 'auto' || !capabilities) return;
    const pool = capabilities[kind];
    if (pool.length === 0) return;
    if (pool.some(m => m.id === modelByKind[kind])) return;
    setModelByKind(prev => ({ ...prev, [kind]: capabilities.defaults[kind] ?? pool[0].id }));
  }, [kind, capabilities, modelByKind, setModelByKind]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [items.length]);

  const submit = (text?: string) => {
    const message = (text ?? draft).trim();
    if (!message || isSending) return;
    if (!text) setDraft('');
    void sendMessage(message, pinnedModel);
  };

  const composer = (
    <div className="rounded-2xl border border-border/60 bg-card focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/5 transition-all">
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        rows={isEmpty ? 3 : 1}
        placeholder={
          pendingIntent ? 'Approve, edit, or cancel above…' : 'Describe what you want to create…'
        }
        className="w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-[15px] leading-relaxed outline-none max-h-40 placeholder:text-muted-foreground/40"
      />
      <div className="flex items-center gap-2 px-3 pb-2.5 pt-1 flex-wrap">
        <div className="flex p-0.5 bg-muted/40 rounded-lg border border-border/50">
          {KIND_OPTIONS.map(option => (
            <button
              key={option.id}
              onClick={() => setKind(option.id)}
              title={
                option.id === 'auto'
                  ? 'Let the agent choose the modality and model'
                  : `Always generate ${option.label.toLowerCase()}`
              }
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors',
                kind === option.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {option.icon && <option.icon size={12} />}
              {option.label}
            </button>
          ))}
        </div>

        {kind !== 'auto' && (
          <ModelPicker
            kind={kind}
            capabilities={capabilities}
            value={pinnedModel ?? ''}
            onChange={id => setModelByKind(prev => ({ ...prev, [kind]: id }))}
            onRefresh={onRefreshCatalog}
            isRefreshing={isRefreshingCatalog}
            compact
          />
        )}

        <div className="ml-auto flex items-center gap-2 shrink-0 pl-2">
          {!isConnected && (
            <span
              title="Reconnecting to the live update channel"
              className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400"
            >
              <WifiOff size={11} />
              <span className="hidden sm:inline">Reconnecting</span>
            </span>
          )}
          <SendButton onClick={() => submit()} busy={isSending} disabled={!draft.trim()} />
        </div>
      </div>
    </div>
  );

  // ── empty: hero ────────────────────────────────────────────────────────────
  if (isEmpty) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-4 overflow-y-auto custom-scrollbar">
        <div className="w-full max-w-2xl space-y-5 py-8">
          <div className="text-center space-y-1.5">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
              <Palette size={20} className="text-primary" />
            </div>
            <h2 className="text-xl font-semibold pt-1.5">What should we make?</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Describe it in your own words. The agent picks the model and settings, then checks
              with you before spending anything.
            </p>
          </div>

          {composer}

          <div className="grid sm:grid-cols-2 gap-2">
            {STARTERS.map(starter => {
              const Icon = STARTER_ICON[starter.kind];
              return (
                <button
                  key={starter.text}
                  onClick={() => submit(starter.text)}
                  className="group flex items-start gap-2.5 text-left px-3 py-2.5 rounded-xl border border-border/50 hover:border-border hover:bg-muted/40 transition-colors"
                >
                  <Icon
                    size={13}
                    className="mt-0.5 shrink-0 text-muted-foreground/60 group-hover:text-primary transition-colors"
                  />
                  <span className="text-xs leading-relaxed text-muted-foreground group-hover:text-foreground transition-colors">
                    {starter.text}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <Lightbox isOpen={!!lightbox} onClose={() => setLightbox(null)} result={lightbox} />
      </div>
    );
  }

  // ── conversation ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">
          {items.map(item => (
            <div
              key={item.key}
              className={cn('flex', item.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div className={cn('max-w-[85%]', item.role === 'user' ? 'order-1' : 'order-none')}>
                {item.role === 'user' ? (
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-3.5 py-2 text-sm">
                    {item.content}
                  </div>
                ) : (
                  <div>
                    <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                      {item.content}
                    </div>
                    {item.requiresHitl && item.intent && (
                      <IntentPreviewCard
                        intent={item.intent}
                        capabilities={capabilities}
                        disabled={isSending || !pendingIntent}
                        onApprove={() => resume('approve')}
                        onEdit={o => resume('edit', o)}
                        onCancel={() => resume('cancel')}
                      />
                    )}
                    {item.generation && (
                      <GenerationBubble
                        generation={item.generation}
                        onOpen={() => {
                          const g = item.generation;
                          if (!g?.output_url) return;
                          setLightbox({
                            url: g.output_url,
                            type: g.type,
                            prompt: g.prompt,
                            model: g.model,
                            timestamp: new Date(),
                          });
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isSending && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" />
              </span>
              Thinking
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border/40 px-4 py-3">
        <div className="max-w-3xl mx-auto">{composer}</div>
      </div>

      <Lightbox isOpen={!!lightbox} onClose={() => setLightbox(null)} result={lightbox} />
    </div>
  );
}
