import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { DEFAULT_MODEL, isModelId } from '@/lib/models';
import type { ChatDocumentMetadata, ChatExcerpt, ChatInputMessage } from '@/lib/chat-request';

interface ProviderErrorDetails { message: string; status?: number; code?: string; name: string; }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getProviderError(error: unknown): ProviderErrorDetails {
  const top = error && typeof error === 'object' ? error as { name?: unknown; message?: unknown; status?: unknown; code?: unknown; cause?: unknown } : {};
  const cause = top.cause && typeof top.cause === 'object' ? top.cause as { message?: unknown; code?: unknown } : {};
  const message = [top.message, cause.message].filter((value): value is string => typeof value === 'string').join(' | ');
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const safeMessage = message.replace(/AIza[\w-]{20,}/g, '[redacted API key]')
    .replace(/(x-goog-api-key\s*[=:" ]+)[^\s,"']+/gi, '$1[redacted]')
    .replace(key ?? '\u0000', '[redacted API key]').slice(0, 600);
  return {
    message: safeMessage || 'Gemini returned no error details.',
    status: typeof top.status === 'number' ? top.status : undefined,
    code: typeof top.code === 'string' ? top.code : typeof cause.code === 'string' ? cause.code : undefined,
    name: typeof top.name === 'string' ? top.name : 'UnknownError',
  };
}

function describeProviderFailure(details: ProviderErrorDetails, locale: 'en' | 'es'): string {
  if (details.status === 503 || /currently experiencing high demand|UNAVAILABLE/i.test(details.message)) return locale === 'es' ? 'Gemini está temporalmente saturado. Inténtalo de nuevo en unos minutos.' : 'Gemini is temporarily at capacity. Please try again in a few minutes.';
  if (/abort|timeout/i.test(`${details.name} ${details.message}`)) return locale === 'es' ? 'La solicitud a Gemini se interrumpió. Inténtalo de nuevo o pregunta sobre menos documentos.' : 'Gemini’s request was interrupted. Try again, or ask about fewer or smaller documents.';
  const rateLimited = details.status === 429 || /rate.?limit|quota/i.test(details.message);
  const invalidKey = details.status === 401 || details.status === 403 || /api.?key|unauthori[sz]ed|permission denied|403/i.test(details.message);
  const unavailableModel = details.status === 404 || /model.{0,40}(not found|unavailable)/i.test(details.message);
  const networkBlocked = ['EACCES', 'ENETUNREACH', 'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'].includes(details.code ?? '');
  if (rateLimited) return locale === 'es' ? 'Gemini está recibiendo demasiadas solicitudes. Inténtalo de nuevo pronto.' : 'Gemini is receiving too many requests. Try again shortly.';
  if (invalidKey) return locale === 'es' ? 'Google rechazó la clave de API. Comprueba que sea válida y esté habilitada para Gemini API.' : 'Google rejected the API key. Check that it is valid and enabled for the Gemini API.';
  if (unavailableModel) return locale === 'es' ? 'Este modelo de Gemini no está disponible para tu proyecto. Comprueba GOOGLE_GENERATIVE_AI_MODEL.' : 'The selected Gemini model is unavailable for this API project. Check GOOGLE_GENERATIVE_AI_MODEL.';
  if (networkBlocked) return locale === 'es' ? 'El servidor no puede conectarse con Gemini. Permite el acceso HTTPS a Google.' : 'The app server cannot reach Gemini. Allow HTTPS access to Google.';
  return locale === 'es' ? 'El asistente no pudo conectarse con Gemini.' : 'The assistant could not connect to Gemini.';
}

export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) return Response.json({ error: 'The request body must be a JSON object.' }, { status: 400 });
    payload = body;
  } catch {
    return Response.json({ error: 'The request could not be read.' }, { status: 400 });
  }
  const locale = payload.locale === 'es' ? 'es' : 'en';
  const question = typeof payload.question === 'string' ? payload.question.trim().slice(0, 8_000) : '';
  if (!question) {
    return Response.json({ error: locale === 'es' ? 'Escribe una pregunta antes de enviarla.' : 'Add a question before sending.' }, { status: 400 });
  }
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return Response.json({ error: locale === 'es' ? 'Añade GOOGLE_GENERATIVE_AI_API_KEY a .env.local para activar las respuestas.' : 'Add GOOGLE_GENERATIVE_AI_API_KEY to .env.local to enable live answers.' }, { status: 503 });
  }
  const isExcerpt = (value: unknown): value is ChatExcerpt => isRecord(value)
    && typeof value.name === 'string'
    && typeof value.location === 'string'
    && typeof value.text === 'string';
  const isMetadata = (value: unknown): value is ChatDocumentMetadata => isRecord(value)
    && typeof value.name === 'string'
    && typeof value.size === 'number';
  const recentMessages = Array.isArray(payload.recentMessages) ? payload.recentMessages
    .filter((message): message is ChatInputMessage => isRecord(message)
      && (message.role === 'user' || message.role === 'assistant')
      && typeof message.content === 'string')
    .slice(-4).map((message) => ({ role: message.role, content: message.content.slice(0, 500) })) : [];
  const conversationMessages = recentMessages[0]?.role === 'assistant' ? recentMessages.slice(1) : recentMessages;
  const excerpts = Array.isArray(payload.excerpts) ? payload.excerpts.filter(isExcerpt).slice(0, 8).map((excerpt) => ({
    name: excerpt.name.slice(0, 200), location: excerpt.location.slice(0, 80), text: excerpt.text.slice(0, 1_000),
  })) : [];
  const documentMetadata = Array.isArray(payload.documentMetadata) ? payload.documentMetadata.filter(isMetadata).slice(0, 40).map((document) => ({
    name: document.name.slice(0, 200), size: Math.max(0, Math.min(document.size, 10 * 1024 * 1024)),
  })) : [];
  const context = excerpts.length
    ? excerpts.map((excerpt) => `DOCUMENT: ${excerpt.name} | ${excerpt.location}\n${excerpt.text}`).join('\n\n---\n\n')
    : documentMetadata.length
      ? `Only document metadata is available; no document contents were shared. Available files: ${documentMetadata.map((document) => `${document.name} (${document.size} bytes)`).join(', ')}.`
      : 'No document contents or metadata were shared.';
  const contextInstruction = excerpts.length
    ? 'Answer factual questions using only the selected excerpts below. If the excerpts do not contain the answer, say so. Cite claims with the exact document filename and supplied page or paragraph location, using markdown links like [Annual report.pdf, Page 4: "a short exact quotation from the passage"](#source-Annual%20report.pdf). For PDF citations, include a short verbatim supporting quote copied exactly from the supplied excerpt so the interface can highlight it. Never invent a page, section, or quote.'
    : payload.documentsSelected === true
      ? 'The user selected documents, but no relevant excerpts were found. Do not guess. Explain that no matching passage was found and ask them to try different search terms.'
      : documentMetadata.length
        ? 'Only filenames and file sizes are available; no document content was shared. Do not infer or claim anything about what the documents contain. Explain that the user can check a document in the library to share relevant excerpts.'
        : 'No documents were selected, so no document content was shared. Ask the user to select documents in the library before answering document-specific questions.';
  const systemInstruction = `You are extractordinaire, a natural and helpful document research assistant. Respond in ${locale === 'es' ? 'Spanish' : 'English'}. Use recent turns to understand follow-up questions, and answer document questions using the selected document passages. ${contextInstruction} If the provided passages support an answer, answer directly and cite the relevant file and page or paragraph. If they only partly support it, give the supported part and say what is missing. Do not claim a document has no content when passages were provided. Keep the conversation relaxed, concise, and easy to scan.\n\nSHARED DOCUMENT CONTEXT\n${context}`;
  const startedAt = Date.now();
  const encoder = new TextEncoder();
  console.info('Gemini request starting', {
    questionChars: question.length,
    excerptCount: excerpts.length,
    excerptChars: excerpts.reduce((total, excerpt) => total + excerpt.text.length, 0),
    metadataCount: documentMetadata.length,
  });

  // Return the HTTP stream before waiting on Gemini's first response. This lets
  // the client show progress immediately and lets provider errors arrive in-body.
  let cancelled = false;
  let releaseProvider: (() => void) | undefined;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (value: string): boolean => {
        if (cancelled) return false;
        try { controller.enqueue(encoder.encode(value)); return true; }
        catch { cancelled = true; return false; }
      };
      let safetyBlocked = false;
      let sentText = false;
      let firstTokenLogged = false;
      try {
        const model = isModelId(payload.model) ? payload.model : process.env.GOOGLE_GENERATIVE_AI_MODEL || DEFAULT_MODEL;
        const fallbackModel = process.env.GOOGLE_GENERATIVE_AI_FALLBACK_MODEL || (model === DEFAULT_MODEL ? 'gemini-3.8-flash' : DEFAULT_MODEL);
        const ai = new GoogleGenAI({
          apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
          httpOptions: { retryOptions: { attempts: 1 } },
        });
        const openStream = async (modelName: string) => {
          console.info('Gemini provider request sent', { model: modelName });
          const waitLog = setInterval(() => {
            if (!cancelled) console.info('Gemini still waiting for stream headers', { elapsedMs: Date.now() - startedAt, model: modelName });
          }, 15_000);
          try {
            return await ai.models.generateContentStream({
              model: modelName,
              contents: [
                ...conversationMessages.map((message) => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] })),
                { role: 'user', parts: [{ text: question }] },
              ],
              config: { systemInstruction, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }, maxOutputTokens: 1024, abortSignal: request.signal },
            });
          } finally {
            clearInterval(waitLog);
          }
        };
        let responseStream: Awaited<ReturnType<typeof ai.models.generateContentStream>>;
        try {
          responseStream = await openStream(model);
        } catch (error) {
          const details = getProviderError(error);
          const unavailable = details.status === 503 || /currently experiencing high demand|UNAVAILABLE/i.test(details.message);
          if (!unavailable || fallbackModel === model || cancelled) throw error;
          console.warn('Gemini model is unavailable; trying fallback', { model, fallbackModel, status: details.status });
          responseStream = await openStream(fallbackModel);
        }
        releaseProvider = () => { void responseStream.return(undefined); };
        if (cancelled) { releaseProvider(); return; }
        console.info('Gemini stream opened', { timeToStreamMs: Date.now() - startedAt });
        while (!cancelled) {
          const { value: chunk, done } = await responseStream.next();
          if (done || cancelled) break;
          if (chunk.candidates?.some((candidate) => candidate.finishReason === 'SAFETY')) safetyBlocked = true;
          if (chunk.text) {
            sentText = true;
            if (!firstTokenLogged) { firstTokenLogged = true; console.info('Gemini first text chunk', { timeToFirstTokenMs: Date.now() - startedAt }); }
            if (!send(chunk.text)) break;
          }
        }
        if (safetyBlocked && !sentText) send("I can't help with that request, but you can ask a different question about your documents.");
        if (!cancelled) console.info('Gemini stream completed', { totalMs: Date.now() - startedAt });
      } catch (error) {
        if (cancelled) return;
        const details = getProviderError(error);
        console.error('Gemini request failed', { name: details.name, status: details.status, code: details.code });
        const status = details.status ? ` (HTTP ${details.status})` : '';
        const code = details.code ? ` [${details.code}]` : '';
        if (details.status === 503 || /currently experiencing high demand|UNAVAILABLE/i.test(details.message)) {
          send(describeProviderFailure(details, locale));
        } else {
          send(`${describeProviderFailure(details, locale)} Gemini said${status}${code}: ${details.message}`);
        }
      } finally {
        if (!cancelled) { try { controller.close(); } catch { /* Reader canceled concurrently. */ } }
      }
    },
    cancel() { cancelled = true; releaseProvider?.(); },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' } });
}
