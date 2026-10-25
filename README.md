# extractordinaire

extractordinaire is a responsive document assistant for uploading PDF and plain-text files, asking questions about selected sources, and receiving streamed answers with citations. The app uses a Next.js App Router frontend and a lightweight server API route that calls Google Gemini.

## Architecture at a glance

```text
Browser
  ├─ Next.js React workspace
  │    ├─ UploadZone ── PDF/TXT extraction (PDF.js)
  │    ├─ Chat view ── hybrid semantic + keyword retrieval locally
  │    ├─ Web Worker ── multilingual E5 embeddings, cached by browser
  │    ├─ MessageBubble ── stream chunks and citation links
  │    └─ PDF citation viewer (loaded on demand)
  ├─ Zustand ── library + conversations in localStorage
  └─ IndexedDB ── original PDFs + local passage vectors
             │ POST /api/chat (question, recent turns, excerpts, metadata)
             ▼
       Next.js route handler ── Google Gemini streaming API
             │ text/plain ReadableStream
             └──────────────────────────────► Chat view
```

The browser builds a local semantic index and retrieves relevant passages from checked documents before sending a request. Only the retrieved excerpts and compact conversation context go to Gemini; full document text and vectors stay in the browser. If no documents are checked, the request includes ready-file metadata only. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the component tree, data flows, and API contract.

## Requirements

- Node.js 20.9 or newer and npm
- A Gemini API key for live model answers (optional for the UI and automated tests)
- Docker and Docker Compose for the container setup

## Run locally (about 5 minutes)

1. Install dependencies:

   ```sh
   npm ci
   ```

2. Create the local environment file. PowerShell:

   ```powershell
   Copy-Item .env.example .env.local
   ```

   macOS/Linux:

   ```sh
   cp .env.example .env.local
   ```

3. For live answers, add a Google AI Studio API key to `GOOGLE_GENERATIVE_AI_API_KEY` in `.env.local`. Leave it blank to explore the UI; the app will show a configuration message when a model answer is requested.

4. Start the development server:

   ```sh
   npm run dev
   ```

5. Open <http://localhost:3000>, upload a PDF or TXT file, check its source box, and ask a question.

PDF text extraction and in-app PDF viewing load the PDF.js worker from unpkg, so PDF operations need network access. Plain-text upload does not need that worker.

## Docker

The frontend and API route run in one Next.js service, so no separate backend container is needed. Copy `.env.example` to `.env`, optionally add the Gemini key, then run:

```sh
docker compose up --build
```

Open <http://localhost:3000>. Stop the container with `docker compose down`. The API key is passed to the server container as an environment variable and is not exposed as a client-side variable. See [Dockerfile](./Dockerfile) and [docker-compose.yml](./docker-compose.yml).

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm test` | Run Vitest component, integration, snapshot, and axe checks |
| `npm run test:e2e` | Run Playwright Chromium end-to-end and responsive checks |
| `npm run build` | Build the production app |
| `npm run start` | Serve a production build |

For Playwright, install Chromium once with `npx playwright install chromium`. `npm run test:e2e` starts an isolated Next dev server on port 3101 unless one is already running there.

GitHub Actions runs lint, type-checking, Vitest, Playwright Chromium, and a production build on pushes and pull requests. See `.github/workflows/ci.yml`.

## Design and implementation decisions

- **Routing:** Next.js App Router keeps the workspace and `/api/chat` route in one deployment. This is a compact app without a separately deployed backend.
- **UI library:** the app uses custom React components and CSS rather than a component library, with Lucide React for icons. This keeps the visual system small and easy to tune.
- **State:** Zustand with persistence stores conversations and extracted document text in browser localStorage. Original PDFs are stored in IndexedDB for citation viewing. Theme, locale, and model preference are stored in localStorage.
- **Streaming:** the client uses `fetch` and reads the response body with `ReadableStream.getReader()`, updating the assistant message as chunks arrive. An `AbortController` supports stopping the current request. The server forwards Gemini chunks from a streaming request.
- **Context size:** only the current question, up to four compact recent turns, selected-document excerpts, and file metadata are sent. Retrieval runs in the browser. The server caps and validates input again.
- **Retrieval:** multilingual E5 Small creates passage and query embeddings in a browser Web Worker. Semantic and keyword ranks are fused locally, and only up to eight selected passages are sent to Gemini. The first indexing operation downloads about 118 MB of quantized model weights; the browser caches them for later sessions. If local inference or IndexedDB is unavailable, retrieval falls back to keyword ranking.
- **Code splitting:** the PDF citation viewer and PDF.js are loaded only when needed.

## LLM configuration and offline mode

Set `GOOGLE_GENERATIVE_AI_API_KEY` in `.env.local` for live Gemini answers. `GOOGLE_GENERATIVE_AI_MODEL` is optional; the default is `gemini-3.5-flash-lite`. `GOOGLE_GENERATIVE_AI_FALLBACK_MODEL` defaults to `gemini-3.8-flash` and is tried when the primary model returns a temporary 503 availability error. The model selector offers both configured model IDs.

There is no user-facing mock-model switch. Offline automated tests stub `fetch` or intercept `/api/chat` with a deterministic streamed response, so the test suite does not need a Gemini key or a call to Google. Without a key, the UI remains usable for local document uploads, but live Q&A is unavailable.

## Limitations and possible improvements

- Data is local to the browser profile. There is no sign-in, shared workspace, server-side document storage, or cross-device sync.
- Semantic retrieval depends on a one-time browser download of the quantized embedding model and on browser WebAssembly/WebGPU-compatible inference performance. Keyword ranking remains as a fallback. Retrieval can still miss complex cross-document reasoning, and selected passages are bounded to control Gemini context size.
- PDF extraction is text-based; scanned/image-only PDFs need OCR. PDF.js worker loading currently depends on unpkg.
- The model response is not independently fact-checked. Citations are based on retrieved source passages and model output.
- The axe test covers a core message component, not every route and interaction. Add a full-page accessibility audit and broaden browser/device coverage.
- Add OCR for scanned PDFs, reranking, user-managed server storage, and stronger PDF viewer cross-browser checks if the product grows.

See [ARCHITECTURE.md](./ARCHITECTURE.md), [DESIGN.md](./DESIGN.md), and [TESTING.md](./TESTING.md) for detailed documentation.
