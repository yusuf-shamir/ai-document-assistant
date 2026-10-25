'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, UserRound } from 'lucide-react';
import { useAppStore } from '@/store/use-document-store';
import { useI18n } from '@/lib/i18n';

interface MessageBubbleProps { role: 'user' | 'assistant' | 'system'; content: string; isStreaming?: boolean; }

function linkifyCitationLabels(content: string, filenames: string[]) {
  return [...filenames].sort((a, b) => b.length - a.length).reduce((result, filename) => {
    const escapedName = filename.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const pattern = new RegExp(`\\[?${escapedName}\\s*[,\\u2014\\u2013-]\\s*((?:Page|Paragraph)\\s+\\d+)(?:\\s*:\\s*["\\u201c](.+?)["\\u201d])?\\]?(?:\\([^)]*\\))?`, 'giu');
    return result.replace(pattern, (_match, location: string, quote: string | undefined) => {
      const label = `${filename}, ${location}${quote ? `: "${quote}"` : ''}`;
      return `[${label}](#source-${encodeURIComponent(filename)})`;
    });
  }, content);
}

export function MessageBubble({ role, content, isStreaming = false }: MessageBubbleProps) {
  const documents = useAppStore((state) => state.documents);
  const { strings } = useI18n();
  if (role === 'system') return <div className="system-message" role="status">{content}</div>;
  const isUser = role === 'user';
  const markdownContent = !isUser && !isStreaming ? linkifyCitationLabels(content, Object.values(documents).map((document) => document.name)) : content;
  return <article className={`message message-${role}`}>
    <div className={`message-avatar ${isUser ? 'avatar-user' : 'avatar-assistant'}`} aria-hidden="true">{isUser ? <UserRound size={16} /> : <Bot size={17} />}</div>
    <div className="message-content"><div className="message-byline">{isUser ? strings.you : 'extractordinaire'}{!isUser && <span className="answer-label">{strings.answer}</span>}</div>
      {content ? <div className={`markdown-body${isStreaming ? ' markdown-streaming' : ''}`}>{isStreaming ? <span>{content}</span> : <ReactMarkdown components={{ a: ({ href, children, node: _node, ...props }: React.ComponentProps<'a'> & { node?: unknown }) => {
        void _node;
        const citationLabel = React.Children.toArray(children).map((child) => typeof child === 'string' ? child : '').join('');
        const rawTarget = href?.startsWith('#source-') ? href.slice('#source-'.length).split(/[?#]/u, 1)[0] : undefined;
        let targetName = rawTarget;
        if (targetName) {
          try { targetName = decodeURIComponent(targetName); } catch { /* Keep malformed fragments matchable by their visible label. */ }
        }
        const source = Object.values(documents).find((document) => targetName && document.name.toLocaleLowerCase() === targetName.toLocaleLowerCase())
          ?? Object.values(documents).find((document) => citationLabel.toLocaleLowerCase().includes(document.name.toLocaleLowerCase()))
          ?? (rawTarget && /\b(?:Page|Paragraph)\s+\d+/iu.test(citationLabel) && Object.values(documents).length === 1 ? Object.values(documents)[0] : undefined);
        const target = source ? `#source-${encodeURIComponent(source.name)}` : undefined;
        const page = Number(citationLabel.match(/\bPage\s+(\d+)/iu)?.[1] ?? 1);
        const quote = citationLabel.match(/\bPage\s+\d+\s*[:\u2014-]\s*["\u201c](.{4,}?)["\u201d]\s*$/iu)?.[1];
        const reachable = Boolean(source);
        return <a {...props} href={reachable ? target : undefined} aria-disabled={!reachable} style={reachable
          ? { display: 'inline', padding: '2px 6px', border: '1px solid color-mix(in srgb, var(--accent, #53735b) 22%, transparent)', borderRadius: 5, backgroundColor: 'var(--accent-pale, #e8eee8)', color: 'var(--accent-dark, #3f5c46)', fontSize: 11, fontWeight: 600, textDecoration: 'none', cursor: 'pointer' }
          : { color: 'var(--muted, #6b7067)', cursor: 'not-allowed' }} onClick={(event) => {
          if (!target || !source) return;
          event.preventDefault();
          window.history.replaceState(null, '', target);
          if (source.name.toLowerCase().endsWith('.pdf')) {
            window.dispatchEvent(new CustomEvent('clarity-open-citation', { detail: { documentId: source.id, documentName: source.name, page, quote } }));
          } else if (window.matchMedia('(max-width: 680px)').matches) {
            window.dispatchEvent(new CustomEvent('clarity-open-source', { detail: target.slice(1) }));
          } else {
            document.getElementById(target.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }}>{children}</a>;
      } }}>{markdownContent}</ReactMarkdown>}{isStreaming && <span className="typing-cursor" aria-hidden="true" />}</div> : isStreaming ? <div className="thinking-state" role="status" aria-live="polite"><span className="thinking-dots" aria-hidden="true"><i /><i /><i /></span><span>{strings.thinking}</span></div> : null}
    </div>
  </article>;
}
