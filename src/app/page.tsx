'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { AlertTriangle, ArrowDown, ArrowRight, ArrowUp, Check, FilePlus2, FileSearch, Menu, Moon, Plus, Sparkles, Square, Sun, Trash2, X } from 'lucide-react';
import UploadZone from '@/components/UploadZone';
import { Brand } from '@/components/Brand';
import { MessageBubble } from '@/components/chat/MessageBubble';
import type { PdfCitation } from '@/components/PdfCitationViewer';
import { useChatStream } from '@/hooks/use-chat-stream';
import { selectActiveConversation, useAppStore } from '@/store/use-document-store';
import { useI18n, type Locale } from '@/lib/i18n';
import { useModelSelection } from '@/hooks/use-model-selection';
import type { ModelId } from '@/lib/models';

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
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
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

  useEffect(() => {
    if (!conversationToDelete) return;
    cancelDeleteRef.current?.focus();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setConversationToDelete(null);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [conversationToDelete]);

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
  </main>{pdfCitation && <PdfCitationViewer key={`${pdfCitation.documentId}:${pdfCitation.page}:${pdfCitation.quote ?? ''}`} citation={pdfCitation} onClose={() => setPdfCitation(null)} />}{conversationToDelete && <div className="confirm-scrim" style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(24, 28, 23, 0.52)', backdropFilter: 'blur(3px)' }} onMouseDown={(event) => { if (event.target === event.currentTarget) setConversationToDelete(null); }}>
    <section className="confirm-dialog" style={{ boxSizing: 'border-box', width: 'min(100%, 400px)', padding: 25, border: `1px solid ${dark ? '#3b4239' : '#e4e7df'}`, borderRadius: 16, background: dark ? '#20241f' : '#ffffff', color: dark ? '#e9ece5' : '#262923', boxShadow: '0 22px 70px rgba(15, 20, 14, 0.24)', fontFamily: 'Arial, Helvetica, sans-serif' }} role="alertdialog" aria-modal="true" aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-description" onKeyDown={(event) => {
      if (event.key === 'Tab' && event.shiftKey && document.activeElement === cancelDeleteRef.current) {
        event.preventDefault(); document.getElementById('confirm-delete-button')?.focus();
      } else if (event.key === 'Tab' && !event.shiftKey && document.activeElement?.id === 'confirm-delete-button') {
        event.preventDefault(); cancelDeleteRef.current?.focus();
      }
    }}>
      <div className="confirm-icon" style={{ display: 'grid', placeItems: 'center', width: 42, height: 42, marginBottom: 17, borderRadius: 12, background: dark ? '#3a2b28' : '#f7e9e6', color: dark ? '#e89b90' : '#b2544a' }}><AlertTriangle size={21} aria-hidden="true" /></div>
      <h2 id="delete-dialog-title" style={{ margin: 0, fontSize: 17, fontWeight: 650, letterSpacing: '-0.25px' }}>{strings.deleteConversation}</h2>
      <p id="delete-dialog-description" style={{ margin: '9px 0 22px', color: dark ? '#b1b7ac' : '#676c63', fontSize: 13, lineHeight: 1.55, overflowWrap: 'anywhere' }}>{strings.deleteConversationConfirm.replace('{title}', conversationToDelete.title)}</p>
      <div className="confirm-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 9 }}><button ref={cancelDeleteRef} type="button" className="button button-subtle" style={{ minHeight: 40, padding: '0 13px', border: `1px solid ${dark ? '#3b4239' : '#e4e7df'}`, borderRadius: 9, background: dark ? '#20241f' : '#ffffff', color: dark ? '#b1b7ac' : '#676c63', fontSize: 13, fontWeight: 600, cursor: 'pointer' }} onClick={() => setConversationToDelete(null)}>{strings.cancel}</button><button id="confirm-delete-button" type="button" className="button button-danger" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 40, padding: '0 13px', border: 0, borderRadius: 9, background: dark ? '#e89b90' : '#b2544a', color: dark ? '#241816' : '#ffffff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }} onClick={() => { removeConversation(conversationToDelete.id); setConversationToDelete(null); }}><Trash2 size={15} aria-hidden="true" />{strings.deleteConversation}</button></div>
    </section>
  </div>}</>;
}

function EmptyState({ readyCount, selectedCount, processingCount, locale, strings, onUpload, onSelectSources, onExample }: {
  readyCount: number;
  selectedCount: number;
  processingCount: number;
  locale: Locale;
  strings: ReturnType<typeof useI18n>['strings'];
  onUpload: () => void;
  onSelectSources: () => void;
  onExample: (prompt: string) => void;
}) {
  const prompts = [strings.promptTakeaways, strings.promptRecommendations, strings.promptDates];
  const stage = readyCount === 0 ? 'upload' : selectedCount === 0 ? 'select' : 'ask';
  const waiting = readyCount === 0 && processingCount > 0;
  const title = waiting ? strings.onboardingProcessingTitle : stage === 'upload' ? strings.onboardingUploadTitle : stage === 'select' ? strings.onboardingSelectTitle : strings.questionTitle;
  const description = waiting ? strings.onboardingProcessingDescription : stage === 'upload' ? strings.onboardingUploadDescription : stage === 'select' ? strings.onboardingSelectDescription : strings.askFindAcross.replace('{count}', readyCount === 1 ? (locale === 'es' ? 'tu fuente' : 'source') : (locale === 'es' ? 'tus fuentes' : 'sources'));
  const steps = [
    { title: strings.stepAdd, detail: strings.stepFormats, complete: readyCount > 0, active: stage === 'upload' },
    { title: strings.stepSelect, detail: strings.stepSelectDescription, complete: selectedCount > 0, active: stage === 'select' },
    { title: strings.stepAsk, detail: strings.stepAskDescription, complete: false, active: stage === 'ask' },
  ];

  return <div className={`empty-state empty-state-${stage}`}>
    <div className="empty-illustration" aria-hidden="true"><span className="illustration-sheet sheet-back" /><span className="illustration-sheet sheet-front"><FileSearch size={27} strokeWidth={1.5} /></span><span className="illustration-sparkle"><Sparkles size={15} /></span></div>
    <span className="eyebrow">{strings.eyebrow}</span>
    <h1>{title}</h1>
    <p className="onboarding-description">{description}</p>
    <ol className="empty-steps" aria-label={strings.onboardingProgress}>
      {steps.map((step, index) => <li key={step.title} className={`onboarding-step ${step.complete ? 'is-complete' : ''} ${step.active ? 'is-active' : ''}`} aria-current={step.active ? 'step' : undefined}>
        <span className="onboarding-step-number">{step.complete ? <Check size={13} aria-hidden="true" /> : `0${index + 1}`}</span>
        <strong>{step.title}</strong>
        <small>{step.detail}</small>
      </li>)}
    </ol>
    {stage === 'upload' && <div className="onboarding-action-card">
      <span className="onboarding-action-icon"><FilePlus2 size={19} aria-hidden="true" /></span>
      <span className="onboarding-action-copy"><strong>{waiting ? strings.processing : strings.formatsLimit}</strong><small>{waiting ? strings.onboardingProcessingDescription : strings.readyNote}</small></span>
      <button type="button" className="button button-primary onboarding-button" onClick={onUpload}>{waiting ? strings.onboardingAddAnother : strings.onboardingUploadCta}<ArrowRight size={15} aria-hidden="true" /></button>
    </div>}
    {stage === 'select' && <div className="onboarding-action-card">
      <span className="onboarding-action-icon"><Check size={19} aria-hidden="true" /></span>
      <span className="onboarding-action-copy"><strong>{strings.stepSelect}</strong><small>{strings.onboardingSelectHint}</small></span>
      <button type="button" className="button button-primary onboarding-button" onClick={onSelectSources}>{strings.onboardingSelectCta}<ArrowRight size={15} aria-hidden="true" /></button>
    </div>}
    {stage === 'ask' ? <>
      <div className="onboarding-prompt-heading">{strings.onboardingExamples}</div>
      <div className="suggestion-grid">{prompts.map((prompt, index) => <button key={prompt} className="suggestion-card" onClick={() => onExample(prompt)}><span>{['✳', '↗', '⌁'][index]}</span>{prompt}<ArrowDown size={14} className="suggestion-arrow" /></button>)}</div>
    </> : <div className="onboarding-example-preview"><strong>{strings.onboardingExamples}</strong><div>{prompts.map((prompt) => <span key={prompt}>{prompt}</span>)}</div></div>}
  </div>;
}
