'use client';

import { ArrowDown, ArrowRight, Check, FilePlus2, FileSearch, Sparkles } from 'lucide-react';
import type { useI18n, Locale } from '@/lib/i18n';

type Strings = ReturnType<typeof useI18n>['strings'];

interface EmptyStateProps {
  readyCount: number;
  selectedCount: number;
  processingCount: number;
  locale: Locale;
  strings: Strings;
  onUpload: () => void;
  onSelectSources: () => void;
  onExample: (prompt: string) => void;
}

export function EmptyState({ readyCount, selectedCount, processingCount, locale, strings, onUpload, onSelectSources, onExample }: EmptyStateProps) {
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
