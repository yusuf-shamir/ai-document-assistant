export const MODEL_OPTIONS = [
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite' },
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
] as const;

export type ModelId = (typeof MODEL_OPTIONS)[number]['id'];
export const DEFAULT_MODEL: ModelId = 'gemini-3.5-flash-lite';

export function isModelId(value: unknown): value is ModelId {
  return typeof value === 'string' && MODEL_OPTIONS.some((model) => model.id === value);
}
