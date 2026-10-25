'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { getOriginalPdf } from '@/lib/document-files';
import { useI18n } from '@/lib/i18n';

export interface PdfCitation {
  documentId: string;
  documentName: string;
  page: number;
  quote?: string;
}

interface PdfCitationViewerProps {
  citation: PdfCitation;
  onClose: () => void;
}

type ViewerStatus = 'loading' | 'ready' | 'missing' | 'error';

function normalizeText(value: string) {
  return value.toLocaleLowerCase().replace(/\s+/gu, ' ').trim();
}

export function PdfCitationViewer({ citation, onClose }: PdfCitationViewerProps) {
  const { strings } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<import('pdfjs-dist').PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(citation.page);
  const [pageCount, setPageCount] = useState(0);
  const [status, setStatus] = useState<ViewerStatus>('loading');
  const [highlightFound, setHighlightFound] = useState(true);

  useEffect(() => {
    if (!citation) return;
    let disposed = false;
    let loadingTask: import('pdfjs-dist').PDFDocumentLoadingTask | null = null;
    pdfRef.current = null;
    void (async () => {
      try {
        const file = await getOriginalPdf(citation.documentId);
        if (disposed) return;
        if (!file) { setStatus('missing'); return; }
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
        const pdf = await loadingTask.promise;
        if (disposed) return;
        pdfRef.current = pdf;
        setPageCount(pdf.numPages);
        setPage(Math.min(Math.max(citation.page, 1), pdf.numPages));
        setStatus('ready');
      } catch {
        if (!disposed) setStatus('error');
      }
    })();
    return () => {
      disposed = true;
      pdfRef.current = null;
      if (loadingTask) void loadingTask.destroy();
    };
  }, [citation]);

  useEffect(() => {
    const pdf = pdfRef.current;
    const canvas = canvasRef.current;
    if (!citation || !pdf || !canvas || status !== 'ready') return;
    let cancelled = false;
    let renderTask: import('pdfjs-dist').RenderTask | null = null;
    void (async () => {
      try {
        const pdfPage = await pdf.getPage(page);
        if (cancelled) return;
        const viewport = pdfPage.getViewport({ scale: 1.35 });
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas is unavailable.');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        renderTask = pdfPage.render({ canvas, canvasContext: context, viewport });
        await renderTask.promise;
        if (cancelled || !citation.quote) { setHighlightFound(!citation.quote); return; }

        const textContent = await pdfPage.getTextContent();
        const items = textContent.items.filter((item): item is typeof item & { str: string; transform: number[]; width: number } => 'str' in item && 'transform' in item && 'width' in item);
        let pageText = '';
        const ranges = items.map((item) => {
          const start = pageText.length;
          pageText += `${item.str} `;
          return { start, end: pageText.length - 1, item };
        });
        const foundAt = normalizeText(pageText).indexOf(normalizeText(citation.quote));
        setHighlightFound(foundAt >= 0);
        if (foundAt < 0 || cancelled) return;
        const target = normalizeText(citation.quote);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = 'rgba(255, 210, 60, 0.42)';
        ctx.strokeStyle = 'rgba(191, 132, 0, 0.9)';
        ctx.lineWidth = 1.5;
        for (const range of ranges) {
          if (range.end <= foundAt || range.start >= foundAt + target.length) continue;
          const transform = (await import('pdfjs-dist')).Util.transform(viewport.transform, range.item.transform);
          const height = Math.hypot(transform[2], transform[3]);
          const x = transform[4];
          const y = transform[5] - height * 0.82;
          const width = range.item.width * viewport.scale;
          ctx.fillRect(x, y, width, height);
          ctx.strokeRect(x, y, width, height);
        }
      } catch {
        if (!cancelled) setHighlightFound(false);
      }
    })();
    return () => { cancelled = true; renderTask?.cancel(); };
  }, [citation, page, status]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [citation, onClose]);

  return <div className="pdf-viewer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="pdf-viewer" role="dialog" aria-modal="true" aria-labelledby="pdf-viewer-title">
      <header className="pdf-viewer-toolbar">
        <div className="pdf-viewer-heading"><strong id="pdf-viewer-title">{citation.documentName}</strong><span>{strings.pdfPage} {page}{pageCount ? ` / ${pageCount}` : ''}</span></div>
        <div className="pdf-viewer-controls"><button type="button" className="pdf-page-control" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || status !== 'ready'} aria-label={strings.previousPage}>‹</button><button type="button" className="pdf-page-control" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page >= pageCount || status !== 'ready'} aria-label={strings.nextPage}>›</button><button type="button" className="icon-button" onClick={onClose} aria-label={strings.closePdfViewer}><X size={19} aria-hidden="true" /></button></div>
      </header>
      <div className="pdf-viewer-content">
        {status === 'loading' && <p className="pdf-viewer-message" role="status">{strings.loadingPdf}</p>}
        {status === 'missing' && <p className="pdf-viewer-message" role="status">{strings.pdfNotStored}</p>}
        {status === 'error' && <p className="pdf-viewer-message" role="alert">{strings.pdfLoadFailed}</p>}
        {status === 'ready' && <><canvas ref={canvasRef} className="pdf-page-canvas" aria-label={`${strings.pdfPage} ${page}`} />{citation.quote && !highlightFound && <p className="pdf-highlight-note" role="status">{strings.pdfHighlightMissing}</p>}</>}
      </div>
    </section>
  </div>;
}
