import { describe, expect, it } from 'vitest';
import { getLatestUserMessage } from './chat-request';

describe('getLatestUserMessage', () => {
  it('returns only the most recent user prompt, regardless of prior assistant turns', () => {
    const messages = [
      { role: 'user' as const, content: 'hi' },
      { role: 'assistant' as const, content: 'Hello! I am extractordinaire.' },
      { role: 'user' as const, content: 'Can I ask you anything about the document?' },
    ];
    expect(getLatestUserMessage(messages)).toEqual({ role: 'user', content: 'Can I ask you anything about the document?' });
  });
});
