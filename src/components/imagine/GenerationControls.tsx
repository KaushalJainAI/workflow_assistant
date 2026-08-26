/**
 * Parameter controls for the Imagine form.
 *
 * Every control here is driven by the selected model's advertised capabilities
 * and renders nothing when that model exposes no such option. The panel this
 * replaces showed a fixed set — including a motion-intensity slider and an FPS
 * selector that OpenRouter's video API does not accept and that the page never
 * sent anywhere.
 */
import type { ReactNode } from 'react';
import { Dices } from 'lucide-react';
import { AspectRatioSelector } from './AspectRatioSelector';
import type { MediaKind, ModelCapability } from '../../api/imagine';
import type { GenerationParams } from '../../hooks/useImagineStudio';
import { cn } from '../../lib/utils';

interface Props {
  kind: MediaKind;
  model: ModelCapability | null;
  params: GenerationParams;
  onChange: (patch: Partial<GenerationParams>) => void;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
          {label}
        </label>
        {hint && <span className="text-[11px] text-primary font-medium">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function ChipRow<T extends string | number>({
  options,
  value,
  onSelect,
  format,
}: {
  options: T[];
  value: T | undefined;
  onSelect: (next: T) => void;
  format?: (option: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(option => (
        <button
          key={String(option)}
          type="button"
          onClick={() => onSelect(option)}
          className={cn(
            'px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors',
            value === option
              ? 'bg-primary/10 border-primary/50 text-primary'
              : 'border-border/50 text-muted-foreground hover:bg-muted/60',
          )}
        >
          {format ? format(option) : String(option)}
        </button>
      ))}
    </div>
  );
}

export function GenerationControls({ kind, model, params, onChange }: Props) {
  if (!model) {
    return (
      <p className="text-xs text-muted-foreground">
        Select a model to see the options it supports.
      </p>
    );
  }

  // Long ratio lists (some models advertise 17) are trimmed to the common ones
  // plus whatever is currently selected, so the panel stays readable.
  const COMMON_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9'];
  const ratios = (model.aspect_ratios ?? []).filter(
    r => COMMON_RATIOS.includes(r) || r === params.aspectRatio,
  );

  return (
    <div className="space-y-6">
      {kind !== 'audio' && ratios.length > 0 && (
        <Field label="Aspect ratio">
          <AspectRatioSelector
            options={ratios}
            value={params.aspectRatio}
            onChange={aspectRatio => onChange({ aspectRatio })}
          />
        </Field>
      )}

      {kind !== 'audio' && (model.resolutions?.length ?? 0) > 0 && (
        <Field label={kind === 'video' ? 'Resolution' : 'Size'}>
          <ChipRow
            options={model.resolutions!}
            value={params.resolution}
            onSelect={resolution => onChange({ resolution })}
          />
        </Field>
      )}

      {kind === 'image' && (model.qualities?.length ?? 0) > 0 && (
        <Field label="Quality">
          <ChipRow
            options={model.qualities!}
            value={params.quality}
            onSelect={quality => onChange({ quality })}
          />
        </Field>
      )}

      {kind === 'video' && (model.durations?.length ?? 0) > 0 && (
        <Field label="Length">
          <ChipRow
            options={model.durations!}
            value={params.duration}
            onSelect={duration => onChange({ duration })}
            format={d => `${d}s`}
          />
        </Field>
      )}

      {kind === 'video' && model.supports_audio && (
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={params.generateAudio}
            onChange={e => onChange({ generateAudio: e.target.checked })}
            className="accent-primary h-4 w-4"
          />
          <span className="text-xs font-medium">Generate audio track</span>
        </label>
      )}

      {kind === 'audio' && (model.voices?.length ?? 0) > 0 && (
        <Field label="Voice">
          <ChipRow
            options={model.voices!}
            value={params.voice}
            onSelect={voice => onChange({ voice })}
          />
        </Field>
      )}

      {kind === 'audio' && (model.voices?.length ?? 0) === 0 && (
        <Field label="Voice" hint="optional">
          <input
            value={params.voice ?? ''}
            onChange={e => onChange({ voice: e.target.value })}
            placeholder="Provider voice id — leave blank for the default"
            className="w-full px-3 py-2 text-xs bg-muted/30 border border-border/50 rounded-xl outline-none focus:border-primary/50 transition-colors"
          />
        </Field>
      )}

      {kind === 'audio' && model.supports_speed && (
        <Field label="Speed" hint={`${params.speed.toFixed(2)}×`}>
          <input
            type="range"
            min={0.25}
            max={4}
            step={0.05}
            value={params.speed}
            onChange={e => onChange({ speed: parseFloat(e.target.value) })}
            className="w-full accent-primary"
          />
        </Field>
      )}

      {kind !== 'audio' && (
        <Field label="Negative prompt" hint="optional">
          <textarea
            value={params.negativePrompt}
            onChange={e => onChange({ negativePrompt: e.target.value })}
            placeholder="What to avoid — text, watermarks, blur…"
            className="w-full min-h-[80px] p-3 text-xs bg-muted/30 border border-border/50 rounded-xl outline-none focus:border-primary/50 transition-colors resize-none leading-relaxed"
          />
        </Field>
      )}

      {model.supports_seed && (
        <Field label="Seed">
          <div className="flex gap-2">
            <input
              value={params.seed}
              onChange={e => onChange({ seed: e.target.value.replace(/[^0-9]/g, '') })}
              placeholder="Random"
              inputMode="numeric"
              className="flex-1 px-3 py-2 text-xs bg-muted/30 border border-border/50 rounded-xl outline-none focus:border-primary/50 transition-colors"
            />
            <button
              type="button"
              onClick={() => onChange({ seed: String(Math.floor(Math.random() * 1_000_000)) })}
              title="Randomize seed"
              className="px-3 rounded-xl border border-border/50 text-muted-foreground hover:bg-muted/60 transition-colors"
            >
              <Dices size={14} />
            </button>
          </div>
        </Field>
      )}
    </div>
  );
}
