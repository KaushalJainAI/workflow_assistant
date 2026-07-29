import { useEffect, useRef, useState } from 'react';
import { Send, Sparkles, Wand2 } from 'lucide-react';
import { useImagineAgent } from '../../hooks/useImagineAgent';
import { IntentPreviewCard } from './IntentPreviewCard';
import { GenerationBubble } from './GenerationBubble';
import { Lightbox } from './Lightbox';
import { MissingCredentialBanner } from './MissingCredentialBanner';
import apiClient from '../../api/client';
import { cn } from '../../lib/utils';

const QUICK_PROMPTS = [
  'A cinematic shot of a neon-lit Tokyo street at night',
  'Lo-fi beat, 30 seconds, jazzy piano',
  'Watercolor painting of a fox in a forest, soft light',
  'Narrate this in a calm voice: "Welcome to the future of media."',
];

export function ImagineChat({
  onLatestGeneration,
}: {
  onLatestGeneration?: (g: { url: string; type: 'image' | 'video' | 'audio'; prompt: string } | null) => void;
}) {
  const { items, isSending, isConnected, pendingIntent, sendMessage, resume } = useImagineAgent();
  const [draft, setDraft] = useState('');
  const [lightbox, setLightbox] = useState<null | { url: string; type: 'image' | 'video' | 'audio'; prompt: string }>(null);
  const [credentialMissing, setCredentialMissing] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Probe capabilities once on mount so we can show the banner BEFORE the
  // user sends a message and gets a vague "no openrouter credential" reply.
  useEffect(() => {
    let cancelled = false;
    apiClient
      .get('/imagine/capabilities/')
      .then(() => { if (!cancelled) setCredentialMissing(null); })
      .catch((err) => {
        if (cancelled) return;
        if (err?.response?.status === 400) {
          setCredentialMissing(
            err.response.data?.detail ||
              'No OpenRouter credential configured for this account.'
          );
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [items.length]);

  useEffect(() => {
    const last = [...items].reverse().find(i => i.generation && i.generation.status === 'completed' && i.generation.output_url);
    if (last && last.generation && onLatestGeneration) {
      onLatestGeneration({
        url: last.generation.output_url!,
        type: last.generation.type,
        prompt: last.generation.prompt,
      });
    }
  }, [items, onLatestGeneration]);

  const submit = () => {
    const t = draft.trim();
    if (!t || isSending) return;
    setDraft('');
    sendMessage(t);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40">
        <Sparkles size={16} className="text-primary" />
        <span className="text-sm font-medium">Imagine agent</span>
        <span className={cn('ml-auto text-[11px] px-2 py-0.5 rounded-full', isConnected ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground')}>
          {isConnected ? 'live' : 'offline'}
        </span>
      </div>

      {credentialMissing && (
        <div className="px-2 pt-2">
          <MissingCredentialBanner detail={credentialMissing} />
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {items.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-12">
            <Wand2 size={28} className="mb-3 opacity-60" />
            <p className="text-sm mb-4">Describe what you want to create.</p>
            <div className="grid gap-2 w-full max-w-md">
              {QUICK_PROMPTS.map(q => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-left text-xs px-3 py-2 rounded-lg border border-border/60 hover:bg-muted/40 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {items.map(item => (
          <div key={item.key} className={cn('flex', item.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn('max-w-[85%]', item.role === 'user' ? 'order-1' : 'order-none')}>
              {item.role === 'user' ? (
                <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-3.5 py-2 text-sm">
                  {item.content}
                </div>
              ) : (
                <div>
                  <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{item.content}</div>
                  {item.requiresHitl && item.intent && (
                    <IntentPreviewCard
                      intent={item.intent}
                      disabled={isSending || !pendingIntent}
                      onApprove={() => resume('approve')}
                      onEdit={(o) => resume('edit', o)}
                      onCancel={() => resume('cancel')}
                    />
                  )}
                  {item.generation && (
                    <GenerationBubble
                      generation={item.generation}
                      onOpen={() => {
                        if (item.generation?.output_url) {
                          setLightbox({
                            url: item.generation.output_url,
                            type: item.generation.type,
                            prompt: item.generation.prompt,
                          });
                        }
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {isSending && (
          <div className="text-xs text-muted-foreground italic">Thinking…</div>
        )}
      </div>

      <div className="border-t border-border/40 p-3">
        <div className="flex gap-2 items-end">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder={pendingIntent ? 'Approve, edit, or cancel above…' : 'Describe what to create…'}
            className="flex-1 resize-none bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 max-h-32"
          />
          <button
            disabled={isSending || !draft.trim()}
            onClick={submit}
            className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      <Lightbox
        isOpen={!!lightbox}
        onClose={() => setLightbox(null)}
        result={lightbox ? { ...lightbox, timestamp: new Date() } : null}
      />
    </div>
  );
}
