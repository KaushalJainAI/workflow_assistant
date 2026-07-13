import { Check, Pencil, X, Wand2, ImageIcon, Video, Headphones } from 'lucide-react';
import { useState } from 'react';
import type { ImagineIntent } from '../../api/imagineAgent';
import { cn } from '../../lib/utils';

interface Props {
  intent: ImagineIntent;
  onApprove: () => void;
  onEdit: (overrides: Partial<ImagineIntent>) => void;
  onCancel: () => void;
  disabled?: boolean;
}

const TYPE_ICON = { image: ImageIcon, video: Video, audio: Headphones } as const;

export function IntentPreviewCard({ intent, onApprove, onEdit, onCancel, disabled }: Props) {
  const [editing, setEditing] = useState(false);
  const [editPrompt, setEditPrompt] = useState(intent.prompt);
  const [editModel, setEditModel] = useState(intent.model || '');
  const Icon = TYPE_ICON[intent.type] || Wand2;

  const params = intent.params || {};
  const chips: Array<[string, any]> = Object.entries(params).filter(([, v]) => v != null && v !== '');

  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur p-4 my-2 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
          <Icon size={16} />
        </div>
        <span className="text-sm font-medium capitalize">{intent.type}</span>
        <span className="text-xs text-muted-foreground">·</span>
        <span className="text-xs text-muted-foreground truncate">{intent.model || 'no model'}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          ~${intent.estimated_cost_usd?.toFixed?.(2) ?? '—'} · {Math.round((intent.confidence ?? 0) * 100)}%
        </span>
      </div>

      {!editing ? (
        <p className="text-sm text-foreground/90 mb-3 leading-relaxed">{intent.prompt}</p>
      ) : (
        <div className="space-y-2 mb-3">
          <textarea
            className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 resize-none"
            rows={3}
            value={editPrompt}
            onChange={e => setEditPrompt(e.target.value)}
          />
          <input
            className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2"
            placeholder="model id"
            value={editModel}
            onChange={e => setEditModel(e.target.value)}
          />
        </div>
      )}

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {chips.map(([k, v]) => (
            <span key={k} className="text-[11px] px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground">
              {k}: {String(v)}
            </span>
          ))}
        </div>
      )}

      {intent.reasoning && (
        <p className="text-[11px] text-muted-foreground italic mb-3">{intent.reasoning}</p>
      )}

      <div className="flex gap-2">
        {!editing ? (
          <>
            <button
              disabled={disabled}
              onClick={onApprove}
              className={cn(
                'flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg',
                'bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50'
              )}
            >
              <Check size={14} /> Approve
            </button>
            <button
              disabled={disabled}
              onClick={() => setEditing(true)}
              className="inline-flex items-center justify-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-border hover:bg-muted/50 transition-colors"
            >
              <Pencil size={14} /> Edit
            </button>
            <button
              disabled={disabled}
              onClick={onCancel}
              className="inline-flex items-center justify-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-border hover:bg-muted/50 transition-colors"
            >
              <X size={14} /> Cancel
            </button>
          </>
        ) : (
          <>
            <button
              disabled={disabled}
              onClick={() => onEdit({ prompt: editPrompt, model: editModel || intent.model || undefined })}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Check size={14} /> Generate with edits
            </button>
            <button
              disabled={disabled}
              onClick={() => setEditing(false)}
              className="inline-flex items-center justify-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-border hover:bg-muted/50 transition-colors"
            >
              Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
