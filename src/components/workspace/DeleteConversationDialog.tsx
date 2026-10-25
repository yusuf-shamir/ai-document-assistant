'use client';

import { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import type { useI18n } from '@/lib/i18n';

interface DeleteConversationDialogProps {
  title: string;
  dark: boolean;
  strings: ReturnType<typeof useI18n>['strings'];
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteConversationDialog({ title, dark, strings, onCancel, onConfirm }: DeleteConversationDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelButtonRef.current?.focus();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onCancel]);

  const surface = dark ? '#20241f' : '#ffffff';
  const border = dark ? '#3b4239' : '#e4e7df';
  const muted = dark ? '#b1b7ac' : '#676c63';

  return <div className="confirm-scrim" style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(24, 28, 23, 0.52)', backdropFilter: 'blur(3px)' }} onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <section className="confirm-dialog" style={{ boxSizing: 'border-box', width: 'min(100%, 400px)', padding: 25, border: `1px solid ${border}`, borderRadius: 16, background: surface, color: dark ? '#e9ece5' : '#262923', boxShadow: '0 22px 70px rgba(15, 20, 14, 0.24)', fontFamily: 'Arial, Helvetica, sans-serif' }} role="alertdialog" aria-modal="true" aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-description" onKeyDown={(event) => {
      if (event.key === 'Tab' && event.shiftKey && document.activeElement === cancelButtonRef.current) {
        event.preventDefault(); document.getElementById('confirm-delete-button')?.focus();
      } else if (event.key === 'Tab' && !event.shiftKey && document.activeElement?.id === 'confirm-delete-button') {
        event.preventDefault(); cancelButtonRef.current?.focus();
      }
    }}>
      <div className="confirm-icon" style={{ display: 'grid', placeItems: 'center', width: 42, height: 42, marginBottom: 17, borderRadius: 12, background: dark ? '#3a2b28' : '#f7e9e6', color: dark ? '#e89b90' : '#b2544a' }}><AlertTriangle size={21} aria-hidden="true" /></div>
      <h2 id="delete-dialog-title" style={{ margin: 0, fontSize: 17, fontWeight: 650, letterSpacing: '-0.25px' }}>{strings.deleteConversation}</h2>
      <p id="delete-dialog-description" style={{ margin: '9px 0 22px', color: muted, fontSize: 13, lineHeight: 1.55, overflowWrap: 'anywhere' }}>{strings.deleteConversationConfirm.replace('{title}', title)}</p>
      <div className="confirm-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 9 }}>
        <button ref={cancelButtonRef} type="button" className="button button-subtle" style={{ minHeight: 40, padding: '0 13px', border: `1px solid ${border}`, borderRadius: 9, background: surface, color: muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }} onClick={onCancel}>{strings.cancel}</button>
        <button id="confirm-delete-button" type="button" className="button button-danger" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 40, padding: '0 13px', border: 0, borderRadius: 9, background: dark ? '#e89b90' : '#b2544a', color: dark ? '#241816' : '#ffffff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }} onClick={onConfirm}><Trash2 size={15} aria-hidden="true" />{strings.deleteConversation}</button>
      </div>
    </section>
  </div>;
}
