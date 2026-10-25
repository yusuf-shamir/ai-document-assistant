import type { DocumentFile } from '@/store/use-document-store';
import { createTextEmbeddings } from '@/lib/embedding-worker-client';
import { deleteSemanticDocument, getSemanticDocument, saveSemanticDocument, type SemanticPassage } from '@/lib/semantic-index-storage';

export interface DocumentExcerpt {
  name: string;
  location: string;
  text: string;
}

const MAX_CHUNK_CHARS = 1_000;
const MAX_EXCERPTS = 8;
const MAX_EXCERPTS_PER_DOCUMENT = 3;
const STOP_WORDS = new Set([
  'a', 'an', 'as', 'at', 'be', 'by', 'do', 'he', 'if', 'in', 'is', 'it', 'me', 'my', 'no', 'of', 'on', 'or', 'so', 'to', 'up', 'us', 'we',
  'about', 'after', 'again', 'also', 'and', 'are', 'because', 'been', 'before', 'being', 'between', 'but', 'can',
  'could', 'did', 'does', 'each', 'for', 'from', 'give', 'have', 'into', 'more', 'most', 'much', 'only', 'other',
  'please', 'some', 'such', 'than', 'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they', 'this',
  'those', 'through', 'under', 'very', 'what', 'when', 'where', 'which', 'who', 'why', 'will', 'with', 'would',
  'como', 'con', 'cual', 'cuando', 'de', 'del', 'desde', 'donde', 'el', 'ella', 'ellas', 'ellos', 'en', 'entre',
  'esta', 'este', 'esto', 'hay', 'la', 'las', 'los', 'mas', 'muy', 'para', 'pero', 'por', 'que', 'quien', 'sin',
  'sobre', 'son', 'sus', 'tambien', 'tiene', 'un', 'una', 'uno', 'unos', 'unas', 'y', 'al', 'es', 'ha', 'lo', 'mi', 'ni', 'se', 'si', 'su',
]);

interface Candidate extends DocumentExcerpt { score: number; }

function normalizeToken(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function terms(value: string) {
  return normalizeToken(value).match(/[\p{L}\p{N}]{2,}/gu)?.filter((word) => !STOP_WORDS.has(word)) ?? [];
}

function splitIntoChunks(text: string, location: string, name: string): DocumentExcerpt[] {
  const units = text.split(/(?<=[.!?])\s+|\n+/u).map((unit) => unit.trim()).filter(Boolean);
  const result: DocumentExcerpt[] = [];
  let current = '';
  const push = () => {
    if (current) result.push({ name, location, text: current });
    current = '';
  };
  for (const unit of units) {
    if (unit.length > MAX_CHUNK_CHARS) {
      push();
      for (let offset = 0; offset < unit.length; offset += MAX_CHUNK_CHARS) {
        const part = unit.slice(offset, offset + MAX_CHUNK_CHARS).trim();
        if (part) result.push({ name, location, text: part });
      }
      continue;
    }
    if (current && current.length + unit.length + 1 > MAX_CHUNK_CHARS) push();
    current = current ? `${current} ${unit}` : unit;
  }
  push();
  return result;
}

export function chunkDocument(document: Pick<DocumentFile, 'name' | 'text'>): DocumentExcerpt[] {
  const pageMarker = /\[Page\s+(\d+)\]\s*/giu;
  const matches = [...document.text.matchAll(pageMarker)];
  if (matches.length) {
    return matches.flatMap((match, index) => {
      const start = (match.index ?? 0) + match[0].length;
      const end = matches[index + 1]?.index ?? document.text.length;
      return splitIntoChunks(document.text.slice(start, end), `Page ${match[1]}`, document.name);
    });
  }
  return document.text.split(/\n\s*\n/u).flatMap((paragraph, index) =>
    splitIntoChunks(paragraph, `Paragraph ${index + 1}`, document.name),
  );
}

/** Generate and persist a local vector index for one document. */
export async function indexDocumentSemantically(
  id: string,
  document: Pick<DocumentFile, 'name' | 'text'>,
  onProgress?: (progress: { stage: 'model' | 'embedding'; progress: number }) => void,
): Promise<void> {
  const excerpts = chunkDocument(document);
  const vectors = await createTextEmbeddings(excerpts.map((excerpt) => excerpt.text), 'passage', onProgress);
  const passages: SemanticPassage[] = excerpts.map((excerpt, index) => ({ ...excerpt, vector: vectors[index] }));
  await saveSemanticDocument(id, passages);
}

export async function removeSemanticIndex(id: string): Promise<void> {
  await deleteSemanticDocument(id);
}

function sampleExcerpts(documents: DocumentFile[]): DocumentExcerpt[] {
  const groups = documents.map(chunkDocument).filter((chunks) => chunks.length > 0).slice(0, MAX_EXCERPTS);
  if (!groups.length) return [];

  const counts = groups.map(() => 1);
  let total = groups.length;
  const perDocumentLimit = groups.length === 1 ? MAX_EXCERPTS : MAX_EXCERPTS_PER_DOCUMENT;
  while (total < MAX_EXCERPTS) {
    let added = false;
    for (let index = 0; index < groups.length && total < MAX_EXCERPTS; index += 1) {
      if (counts[index] < Math.min(perDocumentLimit, groups[index].length)) {
        counts[index] += 1;
        total += 1;
        added = true;
      }
    }
    if (!added) break;
  }

  return groups.flatMap((chunks, groupIndex) => {
    const count = counts[groupIndex];
    return Array.from({ length: count }, (_, index) => {
      const position = count === 1 ? Math.floor((chunks.length - 1) / 2) : Math.round(index * (chunks.length - 1) / (count - 1));
      return chunks[position];
    });
  }).slice(0, MAX_EXCERPTS);
}

/** Rank passages on-device; full document text never leaves the browser. */
function rankLexically(question: string, candidates: DocumentExcerpt[]): Candidate[] {
  const queryTerms = [...new Set(terms(question))];
  if (!queryTerms.length) return [];
  const documentFrequency = new Map<string, number>();
  for (const candidate of candidates) {
    const chunkTerms = new Set(terms(candidate.text));
    for (const term of queryTerms) if (chunkTerms.has(term)) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
  }

  const ranked: Candidate[] = candidates.map((candidate) => {
    const chunkTerms = new Set(terms(candidate.text));
    const score = queryTerms.reduce((total, term) => {
      if (!chunkTerms.has(term)) return total;
      const frequency = documentFrequency.get(term) ?? 1;
      return total + 1 + Math.log(1 + candidates.length / frequency);
    }, 0);
    return { ...candidate, score };
  }).filter((candidate) => candidate.score > 0).sort((a, b) => b.score - a.score || a.text.length - b.text.length);

  return ranked;
}

function limitExcerpts(ranked: DocumentExcerpt[]): DocumentExcerpt[] {
  const perDocument = new Map<string, number>();
  const selected: DocumentExcerpt[] = [];
  for (const candidate of ranked) {
    const count = perDocument.get(candidate.name) ?? 0;
    if (count >= MAX_EXCERPTS_PER_DOCUMENT) continue;
    selected.push({ name: candidate.name, location: candidate.location, text: candidate.text });
    perDocument.set(candidate.name, count + 1);
    if (selected.length >= MAX_EXCERPTS) break;
  }
  return selected;
}

function cosineSimilarity(left: Float32Array, right: Float32Array): number {
  const length = Math.min(left.length, right.length);
  let dot = 0;
  for (let index = 0; index < length; index += 1) dot += left[index] * right[index];
  return dot;
}

/** Hybrid local retrieval: reciprocal-rank fusion of keyword and multilingual vector search. */
export async function retrieveRelevantExcerpts(question: string, documents: DocumentFile[]): Promise<DocumentExcerpt[]> {
  if (!documents.length) return [];

  const candidates = documents.flatMap(chunkDocument);
  if (!candidates.length) return [];
  const lexical = rankLexically(question, candidates);

  try {
    const indexed = await Promise.all(documents.map((document) => getSemanticDocument(document.id)));
    const missingIndexes = documents.filter((_document, index) => indexed[index] === null);
    if (missingIndexes.length) {
      // Libraries created before semantic RAG have no vectors yet. Start the
      // backfill without holding up this question; keyword retrieval can answer
      // it now, and future questions use the completed semantic index.
      void Promise.all(missingIndexes.map((document) =>
        indexDocumentSemantically(document.id, { name: document.name, text: document.text }),
      )).catch(() => undefined);
      const keywordResults = limitExcerpts(lexical);
      return keywordResults.length ? keywordResults : sampleExcerpts(documents);
    }
    const [queryVector] = await createTextEmbeddings([question], 'query');
    const semantic = indexed.flatMap((passages) => passages ?? []).map((passage) => ({ ...passage, score: cosineSimilarity(queryVector, passage.vector) }))
      .sort((left, right) => right.score - left.score);

    // Use ranks rather than raw scores so keyword counts and cosine similarities
    // can contribute on a comparable scale. RRF also works well for paraphrases.
    const fused = new Map<string, { excerpt: DocumentExcerpt; score: number }>();
    const keyOf = (excerpt: DocumentExcerpt) => `${excerpt.name}\u0000${excerpt.location}\u0000${excerpt.text}`;
    const addRanks = (items: DocumentExcerpt[], weight: number) => items.forEach((excerpt, index) => {
      const key = keyOf(excerpt);
      const entry = fused.get(key) ?? { excerpt, score: 0 };
      entry.score += weight / (60 + index + 1);
      fused.set(key, entry);
    });
    addRanks(lexical, 1);
    addRanks(semantic, 1);
    const ranked = [...fused.values()].sort((left, right) => right.score - left.score).map(({ excerpt }) => excerpt);
    return limitExcerpts(ranked);
  } catch {
    // Keep Q&A usable if the browser cannot load/run the embedding model or
    // IndexedDB is unavailable. The lexical index remains entirely local.
    return limitExcerpts(lexical).length ? limitExcerpts(lexical) : sampleExcerpts(documents);
  }
}
