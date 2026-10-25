'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { ArrowUp, Menu, Moon, Plus, Sparkles, Square, Sun, Trash2, X } from 'lucide-react';
import UploadZone from '@/components/UploadZone';
import { Brand } from '@/components/Brand';
import { MessageBubble } from '@/components/chat/MessageBubble';
import type { PdfCitation } from '@/components/PdfCitationViewer';
import { useChatStream } from '@/hooks/use-chat-stream';
import { selectActiveConversation, useAppStore } from '@/store/use-document-store';
import { useI18n } from '@/lib/i18n';
import { useModelSelection } from '@/hooks/use-model-selection';
import type { ModelId } from '@/lib/models';
import { EmptyState } from '@/components/workspace/EmptyState';
import { DeleteConversationDialog } from '@/components/workspace/DeleteConversationDialog';

const PdfCitationViewer = dynamic(
  () => import('@/components/PdfCitationViewer').then((module) => module.PdfCitationViewer),
  { loading: () => <div className="pdf-viewer-backdrop"><p className="pdf-viewer-message" role="status">Opening citation…</p></div> },
);

function useTheme() {
  const dark = useSyncExternalStore(
    (onChange) => { window.addEventListener('clarity-theme-change', onChange); return () => window.removeEventListener('clarity-theme-change', onChange); },
    () => localStorage.getItem('clarity-theme') === 'dark',
    () => false,
  );
  useEffect(() => {
    const saved = localStorage.getItem('clarity-theme');
    const isDark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (!saved) localStorage.setItem('clarity-theme', isDark ? 'dark' : 'light');
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    window.dispatchEvent(new Event('clarity-theme-change'));
  }, []);
  const toggle = () => {
    const next = !dark; localStorage.setItem('clarity-theme', next ? 'dark' : 'light');
    document.documentElement.dataset.theme = next ? 'dark' : 'light'; window.dispatchEvent(new Event('clarity-theme-change'));
  };
  return { dark, toggle };
}

export default function WorkspacePage() {
  const { conversations, activeConversationId, documents, isStreaming, newConversation, selectConversation, removeConversation } = useAppStore();
  const active = useAppStore(selectActiveConversation);
  const { askQuestion, stopGeneration } = useChatStream();
  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<{ id: string; title: string } | null>(null);
  const [pdfCitation, setPdfCitation] = useState<PdfCitation | null>(null);
  const { dark, toggle } = useTheme();
  const { locale, strings, toggleLocale } = useI18n();
  const { model, selectModel, models } = useModelSelection();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerWasOpenedRef = useRef(false);
  const documentList = Object.values(documents);
  const readyCount = documentList.filter((document) => document.status === 'ready').length;
  const selectedCount = documentList.filter((document) => document.status === 'ready' && document.selected).length;
  const processingCount = documentList.filter((document) => document.status === 'uploading' || document.status === 'indexing').length;
  const chooseDocuments = () => window.dispatchEvent(new Event('clarity-browse-files'));
  const focusSourceSelection = () => {
    const focusFirstSource = () => document.querySelector<HTMLInputElement>('.document-select input:not(:disabled)')?.focus();
    if (window.matchMedia('(max-width: 680px)').matches) {
      setSidebarOpen(true);
      window.setTimeout(focusFirstSource, 280);
    } else {
      focusFirstSource();
    }
  };

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [active?.messages]);
  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); newConversation(); }
    };
    const onOpenSource = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      setSidebarOpen(true);
      window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 260);
    };
    const onOpenCitation = (event: Event) => setPdfCitation((event as CustomEvent<PdfCitation>).detail);
    window.addEventListener('keydown', onShortcut);
    window.addEventListener('clarity-open-source', onOpenSource);
    window.addEventListener('clarity-open-citation', onOpenCitation);
    return () => { window.removeEventListener('keydown', onShortcut); window.removeEventListener('clarity-open-source', onOpenSource); window.removeEventListener('clarity-open-citation', onOpenCitation); };
  }, [newConversation]);
  useEffect(() => {
    if (sidebarOpen && window.matchMedia('(max-width: 680px)').matches) {
      drawerWasOpenedRef.current = true;
      closeButtonRef.current?.focus();
      const closeDrawerOnDesktop = () => {
        if (!window.matchMedia('(max-width: 680px)').matches) setSidebarOpen(false);
      };
      const handleDrawerKeys = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          setSidebarOpen(false);
          return;
        }
        if (event.key !== 'Tab') return;
        const focusable = sidebarRef.current?.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        );
        const items = Array.from(focusable ?? []).filter((item) => item.getClientRects().length > 0);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      };
      document.addEventListener('keydown', handleDrawerKeys);
      window.addEventListener('resize', closeDrawerOnDesktop);
      return () => {
        document.removeEventListener('keydown', handleDrawerKeys);
        window.removeEventListener('resize', closeDrawerOnDesktop);
      };
    }
    if (!sidebarOpen && drawerWasOpenedRef.current) {
      drawerWasOpenedRef.current = false;
      if (window.matchMedia('(max-width: 680px)').matches) menuButtonRef.current?.focus();
      else document.getElementById('question-input')?.focus();
    }
  }, [sidebarOpen]);
  const submit = async (question = input) => {
    if (!question.trim() || isStreaming) return;
    setInput(''); setSidebarOpen(false);
    window.requestAnimationFrame(() => inputRef.current?.focus());
    await askQuestion(question);
  };
  const sendOnEnter = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !isStreaming) { event.preventDefault(); void submit(); }
  };

  return <><main className="app-shell" inert={Boolean(conversationToDelete || pdfCitation)}>
    <header className="mobile-topbar" inert={sidebarOpen}><button ref={menuButtonRef} className="icon-button" aria-label={strings.openNavigation} aria-controls="navigation-sidebar" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(true)}><Menu size={20} aria-hidden="true" /></button><Brand /><button className="icon-button locale-toggle" aria-label={strings.toggleLanguage} title={strings.toggleLanguage} onClick={toggleLocale}>{locale === 'en' ? 'ES' : 'EN'}</button><button className="icon-button" aria-label={dark ? strings.switchToLight : strings.switchToDark} onClick={toggle}>{dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}</button></header>
    <aside ref={sidebarRef} id="navigation-sidebar" className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`} aria-label={strings.navigation} role={sidebarOpen ? 'dialog' : undefined} aria-modal={sidebarOpen ? true : undefined}>
      <div className="sidebar-brand"><Brand /><button ref={closeButtonRef} className="icon-button mobile-close" aria-label={strings.closeNavigation} onClick={() => setSidebarOpen(false)}><X size={19} aria-hidden="true" /></button></div>
      <button className="button button-primary new-chat-button" onClick={() => { newConversation(); setSidebarOpen(false); }}><Plus size={16} aria-hidden="true" /> {strings.newConversation} <kbd>⌘ K</kbd></button>
      <div className="history-section"><h2>{strings.recent}</h2><nav aria-label={strings.recent} className="history-list">{conversations.map((conversation) => <div key={conversation.id} className="history-entry"><button type="button" className={`history-item ${activeConversationId === conversation.id ? 'history-active' : ''}`} aria-current={activeConversationId === conversation.id ? 'page' : undefined} onClick={() => { selectConversation(conversation.id); setSidebarOpen(false); }}><span className="history-mark" /> <span>{conversation.title}</span></button><button type="button" className="icon-button delete-conversation" aria-label={`${strings.deleteConversation}: ${conversation.title}`} title={strings.deleteConversation} onClick={() => setConversationToDelete({ id: conversation.id, title: conversation.title })}><Trash2 size={14} aria-hidden="true" /></button></div>)}</nav></div>
      <UploadZone />
      <div className="sidebar-footer"><button className="icon-button locale-toggle" aria-label={strings.toggleLanguage} title={strings.toggleLanguage} onClick={toggleLocale}>{locale === 'en' ? 'ES' : 'EN'}</button><button className="icon-button theme-toggle" aria-label={dark ? strings.switchToLight : strings.switchToDark} title={dark ? strings.switchToLight : strings.switchToDark} onClick={toggle}>{dark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}</button></div>
    </aside>
    {sidebarOpen && <button className="sidebar-scrim" aria-label={strings.closeNavigation} onClick={() => setSidebarOpen(false)} />}
    <section className="workspace" aria-label={strings.conversationMessages} inert={sidebarOpen}>
      <header className="workspace-topbar"><div className="breadcrumb"><span>{strings.workspace}</span><span className="breadcrumb-divider">/</span><strong>{readyCount ? (readyCount === 1 ? strings.sourceCount : strings.sourceCountPlural).replace('{count}', String(readyCount)) : strings.noSources}</strong></div><div className="topbar-controls"><label className="model-picker"><span className="sr-only">{strings.selectModel}</span><select aria-label={strings.selectModel} value={model} onChange={(event) => selectModel(event.currentTarget.value as ModelId)}>{models.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><div className="connection-state"><span /> {strings.geminiStreaming}</div></div></header>
      <section className={`chat-scroll ${active?.messages.length ? '' : 'chat-scroll-empty'}`} aria-label={strings.conversationMessages}>
        {!active?.messages.length ? <EmptyState readyCount={readyCount} selectedCount={selectedCount} processingCount={processingCount} locale={locale} strings={strings} onUpload={chooseDocuments} onSelectSources={focusSourceSelection} onExample={(prompt) => void submit(prompt)} /> : <div className="message-list" aria-live="polite" aria-relevant="additions text">{active.messages.map((message, index) => <MessageBubble key={message.id} role={message.role} content={message.content} isStreaming={isStreaming && index === active.messages.length - 1 && message.role === 'assistant'} />)}<div ref={endRef} /></div>}
      </section>
      <footer className="composer-wrap"><form className="composer" onSubmit={(event) => { event.preventDefault(); void submit(); }}><label className="sr-only" htmlFor="question-input">{strings.askYourDocuments}</label><textarea ref={inputRef} id="question-input" rows={1} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={sendOnEnter} placeholder={readyCount ? strings.askAboutDocuments : strings.addDocumentFirst} />{isStreaming ? <button className="send-button stop-button" type="button" onClick={stopGeneration} aria-label={strings.stopGenerating} title={strings.stopGenerating}><Square size={14} fill="currentColor" aria-hidden="true" /></button> : <button className="send-button" type="submit" disabled={!input.trim()} aria-label={strings.sendMessage}><ArrowUp size={18} aria-hidden="true" /></button>}</form><div className="composer-hint"><span><kbd>Enter</kbd> {strings.enterToSend} <span className="hint-dot">·</span> <kbd>Shift + Enter</kbd> {strings.shiftEnterNewline}</span><span><Sparkles size={12} aria-hidden="true" /> {strings.groundedAnswers}</span></div></footer>
    </section>
  </main>{pdfCitation && <PdfCitationViewer key={`${pdfCitation.documentId}:${pdfCitation.page}:${pdfCitation.quote ?? ''}`} citation={pdfCitation} onClose={() => setPdfCitation(null)} />}{conversationToDelete && <DeleteConversationDialog title={conversationToDelete.title} dark={dark} strings={strings} onCancel={() => setConversationToDelete(null)} onConfirm={() => { removeConversation(conversationToDelete.id); setConversationToDelete(null); }} />}</>;
}

