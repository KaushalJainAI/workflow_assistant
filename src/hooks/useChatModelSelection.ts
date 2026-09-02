/**
 * Which LLM the standalone chat talks to, and the dropdown that changes it.
 *
 * Pulled out of `StandaloneChat` where the load-preferences effect had also
 * acquired an unrelated click-outside listener, so neither could be changed
 * without reasoning about the other. They are separate effects here.
 *
 * The server ships an NVIDIA env key, so chat works without any per-user
 * credential, so the choice is restored unconditionally from localStorage —
 * it is a display preference, not an entitlement.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AIProvider } from '../api/nodeService';

const PROVIDER_KEY = 'standalone_chat_llm_provider';
const MODEL_KEY = 'standalone_chat_llm_model';

/** Works out of the box against the server-side NVIDIA key. */
const DEFAULT_PROVIDER = 'nvidia';
const DEFAULT_MODEL = 'nvidia/nemotron-3-super-120b-a12b';

/**
 * What guest mode runs on, mirroring GUEST_PROVIDER / GUEST_MODEL in
 * `Backend/chat/guest/runtime.py`. The backend pins it per request and ignores
 * anything a client asks for, so these exist only so the UI can name the model
 * that is actually answering — never to choose one.
 */
export const GUEST_PROVIDER = 'nvidia';
export const GUEST_MODEL = 'nvidia/nemotron-3.5-lightning-30b-a3b';

interface Options {
  /** Guests are pinned to the one served model; no choice is offered them. */
  isGuest?: boolean;
  /** Provider list from `useAIModels`; used to validate the stored model. */
  providers: AIProvider[];
}

export function useChatModelSelection({ isGuest = false, providers }: Options) {
  /**
   * Restore the user's last chosen model.
   *
   * This used to be gated on the account having at least one valid credential,
   * which meant the common case — a user on the server-side NVIDIA key — had
   * their choice silently discarded on every reload. The stored pair is now
   * always restored; an id the provider no longer offers is caught by the
   * validation effect below, which is the check that actually matters.
   *
   * Read in a lazy initialiser rather than an effect. `localStorage` is
   * synchronous, so there was never anything to wait for — but the effect made
   * it *look* asynchronous, which is why `isChecking` existed and why
   * `StandaloneChat` rendered a full-screen spinner for exactly one frame on
   * every mount. Reading it during the first render removes the flash, the
   * extra render pass, and the state that coordinated them.
   * (`react-hooks/set-state-in-effect` is what flagged it.)
   */
  const stored = (key: string, fallback: string) => {
    try {
      return localStorage.getItem(key) || fallback;
    } catch {
      // Private mode and "block site data" both throw on access.
      return fallback;
    }
  };

  const [provider, setProvider] = useState(
    () => (isGuest ? GUEST_PROVIDER : stored(PROVIDER_KEY, DEFAULT_PROVIDER)),
  );
  const [model, setModel] = useState(
    () => (isGuest ? GUEST_MODEL : stored(MODEL_KEY, DEFAULT_MODEL)),
  );
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // A lazy initialiser runs once, so the guest flag flipping after mount — the
  // moment auth resolves — still has to be handled. Adjusting during render is
  // React's documented answer for "reset state when a prop changes"; the
  // discarded render is never committed.
  const [wasGuest, setWasGuest] = useState(isGuest);
  if (wasGuest !== isGuest) {
    setWasGuest(isGuest);
    setProvider(isGuest ? GUEST_PROVIDER : stored(PROVIDER_KEY, DEFAULT_PROVIDER));
    setModel(isGuest ? GUEST_MODEL : stored(MODEL_KEY, DEFAULT_MODEL));
  }

  // Close the dropdown on any click outside it.
  useEffect(() => {
    if (!isDropdownOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isDropdownOpen]);

  // A stored model may no longer be offered by its provider; fall back to the
  // provider's first model rather than sending an id the backend will reject.
  //
  // This one stays an effect, and the rule is suppressed rather than satisfied.
  // `react-hooks/set-state-in-effect` is aimed at effects that compute state
  // already derivable during render; this is the other kind — it reconciles
  // stored state against a catalogue that arrives from the server *after*
  // mount, and it writes `localStorage`. Both halves are synchronisation with
  // an external system, which is what an effect is for. Deriving it during
  // render is not available either: `model` is user-editable through `select`
  // and `adopt`, so a derived value would overwrite the choice it is meant to
  // validate.
  useEffect(() => {
    if (isGuest || !providers.length) return;
    const current = providers.find((p) => p.slug === provider);
    if (!current || !current.models.length) return;
    if (current.models.some((m) => m.value === model)) return;

    const fallback = current.models[0].value;
    // See the note above: this is reconciliation with the server's catalogue,
    // not state that could have been derived during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setModel(fallback);
    localStorage.setItem(MODEL_KEY, fallback);
  }, [isGuest, providers, provider, model]);

  /** Persists the choice locally; the caller syncs it to the session. */
  const select = useCallback((nextProvider: string, nextModel: string) => {
    if (isGuest) return;
    localStorage.setItem(PROVIDER_KEY, nextProvider);
    localStorage.setItem(MODEL_KEY, nextModel);
    setProvider(nextProvider);
    setModel(nextModel);
    setDropdownOpen(false);
  }, [isGuest]);

  /**
   * Adopts the pair stored on a loaded session. Deliberately does not write
   * localStorage: opening an old chat should not change the user's default.
   */
  const adopt = useCallback((nextProvider: string, nextModel: string) => {
    if (isGuest) return;
    setProvider(nextProvider);
    setModel(nextModel);
  }, [isGuest]);

  return {
    provider,
    model,
    setProvider,
    isDropdownOpen,
    setDropdownOpen,
    searchQuery,
    setSearchQuery,
    dropdownRef,
    select,
    adopt,
  };
}
