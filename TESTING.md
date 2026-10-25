# Testing strategy

## Run the checks

```sh
npm run lint
npm run typecheck
npm test
npx playwright install chromium   # one-time browser installation
npm run test:e2e
```

`npm test` runs Vitest in jsdom with React Testing Library. Playwright runs separately; its config starts an isolated Next.js development server on `127.0.0.1:3101` and uses the `.next-e2e` build directory. The GitHub Actions workflow runs lint, type-checking, unit/integration tests, Playwright Chromium, and a production build on each push and pull request.

## Coverage

- `src/components/chat/MessageBubble.test.tsx`: user message labeling/content, citation link behavior, a Jest-axe check, and a snapshot of the user message.
- `src/app/document-flow.test.tsx`: upload-to-query integration path. It uploads a TXT file, waits for extraction and ready state, selects the document, verifies the retrieved excerpt in the request, streams mocked answer chunks, and checks the rendered citation link.
- `src/lib/chat-request.test.ts`: shared helper for selecting the most recent user question.
- `e2e/upload-to-answer.spec.ts`: browser-level TXT upload, selection, question, mocked API response, streamed cited answer, and request payload assertion.
- `e2e/responsive-layout.spec.ts`: viewport bounds for the app and PDF dialog at desktop, tablet, narrow mobile, and short viewport sizes.

The automated tests stub or intercept the chat response. They do not call Gemini and do not require a real API key. The accessibility check uses axe against an isolated message component rather than the complete app.

## Results

**Current documentation pass:** `npm run lint` and `npm run typecheck` passed. `npm test` did not reach Vitest: Vite/esbuild failed during config startup with `Cannot read directory "../../..": Access is denied` in this restricted workspace. The test cases therefore have not been revalidated in this run. Playwright and the production build were not rerun during this documentation update. The CI workflow runs all of these checks in GitHub Actions.

## Known gaps

- No full-page axe scan or complete manual WCAG 2.1 AA audit has been recorded.
- The snapshot covers one message state only; there is no screenshot or visual-regression suite.
- E2E coverage currently uses Chromium, mocked chat output, and a text upload. Real Gemini behavior, PDF text extraction/viewer rendering across browsers, dark theme variants, error paths, and keyboard-only end-to-end flows need broader coverage.
- Integration coverage exercises the client upload-to-query path, not a live backend-to-Gemini call.
- The local embedding worker, model download/cache behavior, IndexedDB vector persistence, hybrid ranking quality, and keyword fallback do not yet have dedicated automated coverage. Existing upload-to-query tests may use the keyword fallback when browser workers are unavailable in jsdom.
