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

interface Options {
  /** Retained for call-site symmetry; guests share the same stored default. */
  isGuest?: boolean;
  /** Provider list from `useAIModels`; used to validate the stored model. */
  providers: AIProvider[];
}

export function useChatModelSelection({ providers }: Options) {
  const [provider, setProvider] = useState(DEFAULT_PROVIDER);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isChecking, setIsChecking] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Restore the user's last chosen model.
  //
  // This used to be gated on the account having at least one valid credential,
  // which meant the common case — a user on the server-side NVIDIA key — had
  // their choice silently discarded on every reload. The stored pair is now
  // always restored; an id the provider no longer offers is caught by the
  // validation effect below, which is the check that actually matters.
  useEffect(() => {
    const savedProvider = localStorage.getItem(PROVIDER_KEY);
    const savedModel = localStorage.getItem(MODEL_KEY);
    if (savedProvider) setProvider(savedProvider);
    if (savedModel) setModel(savedModel);
    setIsChecking(false);
  }, []);

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
  useEffect(() => {
    if (!providers.length) return;
    const current = providers.find((p) => p.slug === provider);
    if (!current || !current.models.length) return;
    if (current.models.some((m) => m.value === model)) return;

    const fallback = current.models[0].value;
    setModel(fallback);
    localStorage.setItem(MODEL_KEY, fallback);
  }, [providers, provider, model]);

  /** Persists the choice locally; the caller syncs it to the session. */
  const select = useCallback((nextProvider: string, nextModel: string) => {
    localStorage.setItem(PROVIDER_KEY, nextProvider);
    localStorage.setItem(MODEL_KEY, nextModel);
    setProvider(nextProvider);
    setModel(nextModel);
    setDropdownOpen(false);
  }, []);

  /**
   * Adopts the pair stored on a loaded session. Deliberately does not write
   * localStorage: opening an old chat should not change the user's default.
   */
  const adopt = useCallback((nextProvider: string, nextModel: string) => {
    setProvider(nextProvider);
    setModel(nextModel);
  }, []);

  return {
    provider,
    model,
    setProvider,
    isDropdownOpen,
    setDropdownOpen,
    searchQuery,
    setSearchQuery,
    dropdownRef,
    isChecking,
    select,
    adopt,
  };
}
