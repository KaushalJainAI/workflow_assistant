/**
 * How hard the chosen model is asked to think, and the control that changes it.
 *
 * A sibling to `useChatModelSelection` rather than part of it, because the two
 * answer to different things: a model is chosen from a catalogue, an effort is
 * chosen from *whatever the chosen model happens to offer*. Folding them
 * together would mean the model hook growing a dependency on the catalogue's
 * per-model detail, and every consumer that only wants the model re-rendering
 * when the effort changes.
 *
 * The rule that shapes everything here: **the model can change under the
 * choice**. A user picks `high` on a reasoning model and then switches to one
 * that offers nothing, or offers a different set of rungs. The backend already
 * snaps a stale level to the nearest one the model serves (`llm/effort.py`), so
 * nothing breaks — but the UI must not go on *displaying* a level that is no
 * longer on offer, because a control showing a value the run will not use is
 * worse than no control.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AIProvider } from '../api/nodeService';

const EFFORT_KEY = 'standalone_chat_llm_effort';

/** Cheapest first, mirroring `LADDER` in `Backend/llm/effort.py`. */
export const EFFORT_LADDER = ['none', 'minimal', 'low', 'medium', 'high'] as const;

/**
 * What each rung means, in the user's terms rather than the API's.
 *
 * Worth writing down because the names alone are misleading in one specific
 * way: `none` is not "no reasoning model", it is a reasoning model told to skip
 * the thinking — which is a thing only some models can be asked, and is why the
 * catalogue declares rungs per model instead of the UI assuming all five.
 */
export const EFFORT_LABELS: Record<string, string> = {
  '': 'Default',
  none: 'Instant',
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export const EFFORT_HINTS: Record<string, string> = {
  '': "The model's own default.",
  none: 'Skip the thinking. Fastest and cheapest.',
  minimal: 'A brief pass before answering.',
  low: 'Light reasoning. Good for lookups and short tasks.',
  medium: 'Balanced. Suits most multi-step work.',
  high: 'Think hard. Slower and costs more; for analysis and tricky problems.',
};

interface Options {
  /** Provider list from `useAIModels`. */
  providers: AIProvider[];
  /** The provider slug currently selected. */
  provider: string;
  /** The model value currently selected. */
  model: string;
  /** Guests are pinned to the served model and get no choice here either. */
  isGuest?: boolean;
}

export function useEffortSelection({ providers, provider, model, isGuest = false }: Options) {
  // Read synchronously during the first render, like the model hook: it is
  // localStorage, there was never anything to wait for, and doing it in an
  // effect is what produces a one-frame flash of the wrong value.
  const [effort, setEffort] = useState(() => {
    if (isGuest) return '';
    try {
      return localStorage.getItem(EFFORT_KEY) ?? '';
    } catch {
      // Private mode and "block site data" both throw on access.
      return '';
    }
  });

  /** The rungs the *currently selected* model offers, or `[]` for none. */
  const available = useMemo(() => {
    const entry = providers
      .find((p) => p.slug === provider)
      ?.models.find((m) => m.value === model);
    return entry?.effort_levels ?? [];
  }, [providers, provider, model]);

  const supported = available.length > 0;

  /**
   * Whether the catalogue has actually arrived for this model.
   *
   * The distinction matters exactly once, and it is the reason this is not
   * just `supported`: before `/llm/models/` resolves, *every* model looks like
   * it offers nothing. Discarding the user's stored level on that basis would
   * clear it on every page load. So the reconcile below waits for evidence.
   */
  const known = useMemo(
    () => providers.some((p) => p.slug === provider && p.models.some((m) => m.value === model)),
    [providers, provider, model],
  );

  // Drop a level the current model does not offer. An effect rather than
  // derived state for the same reason the model hook gives: this reconciles a
  // stored choice against a catalogue that arrives after mount and it writes
  // localStorage — synchronisation with an external system, which is what an
  // effect is for. Deriving it would also overwrite the choice it is meant to
  // validate, since `choose` can be called at any time.
  useEffect(() => {
    if (isGuest || !known || !effort) return;
    if (available.includes(effort)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEffort('');
    try {
      localStorage.removeItem(EFFORT_KEY);
    } catch {
      // Nothing to do: the in-memory value is already correct.
    }
  }, [isGuest, known, available, effort]);

  const choose = useCallback((next: string) => {
    if (isGuest) return;
    setEffort(next);
    try {
      if (next) localStorage.setItem(EFFORT_KEY, next);
      else localStorage.removeItem(EFFORT_KEY);
    } catch {
      // A preference that cannot be persisted still applies to this session.
    }
  }, [isGuest]);

  /**
   * Adopt the level stored on a loaded session. Like the model hook's `adopt`,
   * this deliberately skips localStorage: opening an old chat should not change
   * what the user's next new chat starts at.
   */
  const adopt = useCallback((next: string) => {
    if (isGuest) return;
    setEffort(next ?? '');
  }, [isGuest]);

  return {
    /** The chosen level, or `''` for the model's own default. */
    effort,
    /**
     * What to send. `undefined` when this model has no effort control, so the
     * request omits the field entirely rather than asserting a preference
     * about a knob that does not exist.
     */
    effortToSend: supported ? effort : undefined,
    /** Rungs this model offers, cheapest first. Empty means: hide the control. */
    available,
    supported,
    choose,
    adopt,
  };
}
