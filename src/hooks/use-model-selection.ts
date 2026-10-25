'use client';

import { useSyncExternalStore } from 'react';
import { DEFAULT_MODEL, isModelId, MODEL_OPTIONS, type ModelId } from '@/lib/models';

const storageKey = 'extractordinaire-model';
const changeEvent = 'extractordinaire-model-change';

function getModel(): ModelId {
  const saved = localStorage.getItem(storageKey);
  return isModelId(saved) ? saved : DEFAULT_MODEL;
}

function subscribe(onChange: () => void) {
  window.addEventListener(changeEvent, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(changeEvent, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function useModelSelection() {
  const model = useSyncExternalStore(subscribe, getModel, () => DEFAULT_MODEL);
  const selectModel = (next: ModelId) => {
    localStorage.setItem(storageKey, next);
    window.dispatchEvent(new Event(changeEvent));
  };
  return { model, selectModel, models: MODEL_OPTIONS };
}
