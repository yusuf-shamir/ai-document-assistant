'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, LoaderCircle, Plus, Trash2, UploadCloud } from 'lucide-react';
import { useAppStore } from '@/store/use-document-store';
import { useI18n } from '@/lib/i18n';

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function UploadZone() {
  const { documents, uploadFile, removeDocument, setDocumentSelected } = useAppStore();
  const { locale, strings } = useI18n();
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const files = Object.values(documents).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  const selectedCount = files.filter((file) => file.status === 'ready' && file.selected).length;
  useEffect(() => {
    const openFilePicker = () => inputRef.current?.click();
    window.addEventListener('clarity-browse-files', openFilePicker);
    return () => window.removeEventListener('clarity-browse-files', openFilePicker);
  }, []);
  const localizedFileError = (error: string | undefined) => {
    if (locale === 'es') {
      if (error === 'Only PDF and plain text files are supported.') return strings.onlyPdfTxt;
      if (error === 'This file is larger than the 10 MB limit.') return strings.tooLarge;
      if (error === 'No readable text was found in this file.') return strings.unreadableFile;
      if (error === 'We could not read this file.') return strings.fileReadFailed;
    }
    return error;
  };
  const addFiles = async (selected: FileList | File[]) => { for (const file of Array.from(selected)) await uploadFile(file); };
  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault(); setDragActive(false);
    if (event.dataTransfer.files.length) void addFiles(event.dataTransfer.files);
  };

  return <section aria-labelledby="library-title" className="library-panel">
    <div className="section-heading"><div><h2 id="library-title">{strings.yourLibrary}</h2><p>{strings.librarySubtitle}</p></div><span className="count-pill">{files.filter((file) => file.status === 'ready').length} {strings.ready}</span></div>
    <div className={`dropzone ${dragActive ? 'dropzone-active' : ''}`} onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => { event.preventDefault(); setDragActive(true); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragActive(false); }} onDrop={onDrop}>
      <span className="upload-icon"><UploadCloud size={20} aria-hidden="true" /></span>
      <div className="dropzone-copy"><strong>{strings.dropFiles}</strong><span>{strings.formatsLimit}</span></div>
      <button className="button button-subtle browse-button" type="button" onClick={() => inputRef.current?.click()}><Plus size={15} aria-hidden="true" /> {strings.browse}</button>
      <input ref={inputRef} aria-label={strings.chooseFiles} type="file" accept=".pdf,.txt,application/pdf,text/plain" multiple hidden onChange={(event) => { if (event.target.files) void addFiles(event.target.files); event.target.value = ''; }} />
    </div>
    <p className="selection-note">{selectedCount ? strings.selectedFiles.replace('{count}', String(selectedCount)) : strings.selectionHint}</p>
    <div className="document-list" aria-live="polite">
      {files.length === 0 ? <div className="library-empty"><FileText size={19} aria-hidden="true" /><span>{strings.libraryEmpty}</span></div> : files.map((file) => <article className="document-row" id={`source-${encodeURIComponent(file.name)}`} key={file.id}>
        <label className="document-select"><input type="checkbox" checked={Boolean(file.selected)} disabled={file.status !== 'ready'} aria-label={strings.selectDocument.replace('{name}', file.name)} onChange={(event) => setDocumentSelected(file.id, event.target.checked)} /></label>
        <div className={`file-mark ${file.name.toLowerCase().endsWith('.pdf') ? 'file-mark-pdf' : ''}`}><FileText size={17} aria-hidden="true" /></div>
        <div className="document-meta"><strong title={file.name}>{file.name}</strong><span>{formatBytes(file.size)} <i>·</i> {new Date(file.uploadedAt).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric' })}</span>{file.status === 'error' && <span className="file-error" role="status">{localizedFileError(file.error)}</span>}</div>
        <span className={`status-dot status-${file.status}`} title={file.status === 'ready' ? strings.ready : file.status === 'uploading' ? strings.processing : file.status === 'indexing' ? strings.indexing : strings.error} aria-label={file.status === 'ready' ? strings.ready : file.status === 'uploading' ? strings.processing : file.status === 'indexing' ? strings.indexing : strings.error}>{file.status === 'uploading' || file.status === 'indexing' ? <LoaderCircle size={14} className="spin" /> : file.status === 'ready' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}<span className="status-label">{file.status === 'uploading' ? strings.working : file.status === 'indexing' ? strings.indexing : file.status === 'ready' ? strings.ready : strings.error}</span></span>
        <button type="button" className="icon-button remove-button" aria-label={strings.removeDocument.replace('{name}', file.name)} title={strings.removeDocumentTitle.replace('{name}', file.name)} onClick={() => removeDocument(file.id)}><Trash2 size={15} aria-hidden="true" /></button>
        {file.status === 'uploading' && <div className="upload-progress" role="progressbar" aria-label={`${strings.processing}: ${file.name}`} aria-valuetext={strings.processing}><span /></div>}
        {file.status === 'indexing' && <div className="upload-progress index-progress" role="progressbar" aria-label={`${(file.indexProgress ?? 0) < 70 ? strings.modelDownload : strings.indexing}: ${file.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={file.indexProgress ?? 0} aria-valuetext={`${file.indexProgress ?? 0}%`}><span style={{ width: `${file.indexProgress ?? 0}%` }} /></div>}
      </article>)}
    </div>
    <p className="privacy-note"><span aria-hidden="true" /> {strings.filesStayLocal}</p>
  </section>;
}
