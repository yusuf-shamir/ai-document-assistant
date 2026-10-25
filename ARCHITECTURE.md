# Architecture

## High-level structure

```text
src/
├─ app/
│  ├─ page.tsx                       Workspace container and App Router page
│  ├─ layout.tsx                     Root document metadata and styles
│  ├─ globals.css                    Design tokens, layout, and responsive styles
│  └─ api/chat/route.ts              Validates requests and streams Gemini output
├─ components/
│  ├─ Brand.tsx                      App wordmark
│  ├─ UploadZone.tsx                 Upload dropzone and document library
│  ├─ PdfCitationViewer.tsx          PDF page rendering and source highlighting
│  └─ chat/MessageBubble.tsx         User/assistant messages, markdown, citations
├─ hooks/
│  ├─ use-chat-stream.ts             Optimistic messages and client stream reader
│  └─ use-model-selection.ts         Persisted Gemini model preference
├─ lib/
│  ├─ chat-request.ts                Shared request types and message helper
│  ├─ document-retrieval.ts          Local passage chunking and ranking
│  ├─ embedding.worker.ts            Browser-only multilingual E5 inference
│  ├─ embedding-worker-client.ts     Typed upload/query worker client
│  ├─ semantic-index-storage.ts      IndexedDB vector index
│  ├─ document-files.ts              IndexedDB storage for original PDF files
│  ├─ i18n.ts                        English and Spanish strings/state
│  └─ models.ts                      Supported model IDs and default
└─ store/use-document-store.ts       Zustand library and conversation state
```

## Frontend component tree

```text
RootLayout
└─ WorkspacePage (src/app/page.tsx)
   ├─ MobileTopbar
   ├─ NavigationSidebar
   │  ├─ Brand
   │  ├─ ConversationHistory
   │  └─ UploadZone
   │     ├─ FileInput / Dropzone
   │     └─ DocumentLibrary
   └─ ConversationWorkspace
      ├─ WorkspaceToolbar (model and status)
      ├─ ChatScroll
      │  ├─ EmptyState / SuggestedPrompts
      │  └─ MessageList
      │     └─ MessageBubble (Markdown and source links)
      └─ Composer (question input / send / stop)

WorkspacePage also loads PdfCitationViewer dynamically when a citation is opened.
```

## Data flow

### Upload and local storage

```text
PDF/TXT file
   │
   ├─ Validate type and 10 MB limit
   ├─ TXT: read text in browser
   └─ PDF: parse pages with PDF.js; save original in IndexedDB
        │
        ├─ extracted text (including [Page n] markers) ── Zustand persist ── localStorage
        ├─ passage vectors ── multilingual E5 Small in a Web Worker ── IndexedDB
        └─ original PDF ── IndexedDB ── citation viewer
```

After extraction, the browser chunks text by PDF page or TXT paragraph and generates normalized passage vectors with `Xenova/multilingual-e5-small` using the `passage:` prefix. The model runs in a Web Worker and is cached by the browser. Upload status shows local indexing progress. If model download, inference, or IndexedDB fails, upload still completes and Q&A falls back to keyword retrieval. Unsupported, too-large, or unreadable files are marked as errors; users can remove documents and their local indexes.

### Question and streaming answer

```text
Question + checked documents
   │
   ├─ Embed the question locally with the E5 `query:` prefix
   ├─ Fuse semantic and keyword ranks locally; select max 8 passages (max 3 per file)
   ├─ Add user message and empty assistant message immediately (optimistic UI)
   └─ POST /api/chat
        │
        ├─ Validate/cap the JSON request
        ├─ Send current question, up to 4 recent turns (500 chars each),
        │  retrieved excerpts, selected-document flag, metadata, locale, model
        ├─ Gemini generateContentStream
        └─ text/plain ReadableStream chunks ── fetch reader ── update assistant message
```

Retrieval runs entirely in the browser. It combines multilingual vector similarity and keyword ranks with reciprocal-rank fusion. Older library entries without vectors are backfilled in the background while the first query uses keyword retrieval, so that query does not wait for a full document re-index. For checked files, the browser sends only the selected excerpts to Gemini; neither complete document text nor vectors leave the browser. If indexing is unavailable, local keyword ranking provides a fallback. If no files are checked, the request sends ready-file metadata only. If retrieval produces no excerpts, the server is told that no content was shared. A simple greeting is handled locally without calling the API.

Stopping a response aborts the browser request. The server observes the request signal and cancels its provider stream when possible.

### Citation flow

```text
Markdown citation link
   │ custom citation event
   ▼
WorkspacePage state ── dynamic import ── PdfCitationViewer
                                      ├─ read original PDF from IndexedDB
                                      ├─ render cited page using PDF.js
                                      └─ find and highlight supplied quote
```

Text citations can open the matching source in the document library. PDF citations open the page viewer. A PDF viewer page is available only if the original file is still stored in that browser profile.

## API contract

### `POST /api/chat`

Request body (`ChatRequestPayload` from `src/lib/chat-request.ts`):

```json
{
  "question": "What is the deadline?",
  "recentMessages": [
    { "role": "user", "content": "Summarize this policy." },
    { "role": "assistant", "content": "The policy covers ..." }
  ],
  "excerpts": [
    { "name": "policy.pdf", "location": "Page 4", "text": "Applications close June 30." }
  ],
  "documentMetadata": [],
  "documentsSelected": true,
  "locale": "en",
  "model": "gemini-3.5-flash-lite"
}
```

- `question`: required string; trimmed and capped at 8,000 characters.
- `recentMessages`: user/assistant turns only; server accepts up to four and 500 characters per message.
- `excerpts`: selected document passages; server accepts up to eight, with name capped at 200, location at 80, and text at 1,000 characters.
- `documentMetadata`: file names and sizes only; server accepts up to 40.
- `documentsSelected`: indicates that at least one file is checked.
- `locale`: `en` or `es`; all other values use English.
- `model`: one of the supported IDs; invalid/omitted values fall back to server configuration or the default.

Success returns `text/plain; charset=utf-8` as a chunked response body. The client reads chunks progressively. Invalid JSON, empty questions, and missing API key return JSON errors with a non-2xx status. Provider failures after the stream opens are returned as user-readable text in the response stream. The server may try the configured fallback model after a primary-model 503.

The Gemini API key is read only from the server environment and must never be prefixed with `NEXT_PUBLIC_`.

## State management design

- **Zustand (`useAppStore`)** owns document metadata/text, upload actions, conversation history, and active conversation. The `persist` middleware writes the library and conversations to browser localStorage.
- **IndexedDB** stores original PDF blobs and the local semantic index separately because localStorage is not suitable for binary data or vectors.
- **Component state** owns ephemeral view state such as composer text, mobile sidebar visibility, open dialogs, and PDF viewer page.
- **Browser localStorage** holds model, locale, and theme preferences.
- **Streaming state** is global in Zustand so the composer and message list can reflect active generation. The active AbortController lives in the chat hook.

No server-side account or state layer exists. Clearing site data removes local documents and conversations.
