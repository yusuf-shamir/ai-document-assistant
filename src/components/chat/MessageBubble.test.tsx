import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { MessageBubble } from './MessageBubble';
import { useAppStore } from '@/store/use-document-store';

describe('MessageBubble', () => {
  it('labels a user message and renders its content', () => {
    render(<MessageBubble role="user" content="Summarize the report" />);
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getByText('Summarize the report')).toBeInTheDocument();
  });

  it('keeps assistant citations as links to loaded source files', () => {
    useAppStore.setState({ documents: { policy: { id: 'policy', name: 'policy.txt', size: 10, text: '', uploadedAt: new Date().toISOString(), status: 'ready' } } });
    render(<MessageBubble role="assistant" content="The policy starts in June. [policy.txt, Page 2](#source-policy.txt)" />);
    expect(screen.getByRole('link', { name: 'policy.txt, Page 2' })).toHaveAttribute('href', '#source-policy.txt');
  });

  it('has no basic axe accessibility violations', async () => {
    const { container } = render(<MessageBubble role="assistant" content="A clear answer." />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('matches the user message snapshot', () => {
    const { container } = render(<MessageBubble role="user" content="Summarize the report" />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
