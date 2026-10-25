import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import UploadZone from '@/components/UploadZone';
import { useChatStream } from '@/hooks/use-chat-stream';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { selectActiveConversation, useAppStore } from '@/store/use-document-store';

function UploadToQueryHarness() {
  const { askQuestion } = useChatStream();
  const messages = useAppStore((state) => selectActiveConversation(state)?.messages ?? []);
  return <><UploadZone /><button type="button" onClick={() => void askQuestion('What is the policy deadline?')}>Ask</button>{messages.map((message) => <MessageBubble key={message.id} role={message.role} content={message.content} />)}</>;
}

describe('document to answer flow', () => {
  it('uploads text, sends it as context, and renders streamed answer chunks', async () => {
    useAppStore.setState({ documents: {}, conversations: [], activeConversationId: '', isStreaming: false });
    useAppStore.persist.clearStorage();
    useAppStore.getState().newConversation();
    const encoder = new TextEncoder();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(encoder.encode('The deadline is June 30. ')); controller.enqueue(encoder.encode('[policy.txt, Page 1](#source-policy.txt)')); controller.close(); },
    }))));
    render(<UploadToQueryHarness />);
    const file = new File(['The policy deadline is June 30.'], 'policy.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'text', { value: async () => 'The policy deadline is June 30.' });
    fireEvent.change(screen.getByLabelText('Choose PDF or plain text files'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText('policy.txt')).toBeInTheDocument());
    await waitFor(() => expect(useAppStore.getState().documents[Object.keys(useAppStore.getState().documents)[0]]?.status).toBe('ready'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Use policy.txt as a source' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const requestBody = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body)) as { question: string; excerpts: Array<{ name: string; location: string; text: string }>; documentMetadata: Array<{ name: string; size: number }> };
    expect(requestBody.question).toBe('What is the policy deadline?');
    expect(requestBody.excerpts[0]).toMatchObject({ name: 'policy.txt', location: 'Paragraph 1', text: 'The policy deadline is June 30.' });
    expect(requestBody.documentMetadata).toEqual([]);
    await waitFor(() => expect(screen.getByText(/The deadline is June 30/)).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'policy.txt, Page 1' })).toHaveAttribute('href', '#source-policy.txt');
  });
});
