'use client';

import { useEffect, useSyncExternalStore } from 'react';

export const supportedLocales = ['en', 'es'] as const;
export type Locale = (typeof supportedLocales)[number];

const en = {
  openNavigation: 'Open navigation', closeNavigation: 'Close navigation', navigation: 'Navigation and document library',
  switchToLight: 'Switch to light theme', switchToDark: 'Switch to dark theme', toggleLanguage: 'Change language',
  newConversation: 'New conversation', recent: 'RECENT', deleteConversation: 'Delete conversation',
  deleteConversationConfirm: 'Delete “{title}”? This cannot be undone.',
  cancel: 'Cancel',
  pdfPage: 'Page', previousPage: 'Previous page', nextPage: 'Next page', closePdfViewer: 'Close PDF viewer',
  loadingPdf: 'Opening PDF…', pdfNotStored: 'This PDF’s original file is unavailable in this browser. Remove it and upload it again to open citations here.',
  pdfLoadFailed: 'This PDF could not be opened.', pdfHighlightMissing: 'The cited page opened, but the quoted text could not be highlighted.',
  workspace: 'Workspace', sourceCount: '{count} source', sourceCountPlural: '{count} sources', noSources: 'No sources yet',
  geminiStreaming: 'Gemini · streaming', conversationMessages: 'Conversation messages', askYourDocuments: 'Ask your documents a question',
  askAboutDocuments: 'Ask a question about your documents…', addDocumentFirst: 'Add a document, then ask a question…', sendMessage: 'Send message',
  enterToSend: 'to send', shiftEnterNewline: 'for a new line', groundedAnswers: 'Answers grounded in your sources',
  onboardingProgress: 'Getting started', onboardingUploadTitle: 'Start with a document.', onboardingUploadDescription: 'Add a PDF or plain text file. We will find useful passages and link answers back to their source.', onboardingUploadCta: 'Choose a document', onboardingAddAnother: 'Add another document',
  onboardingProcessingTitle: 'Getting your document ready.', onboardingProcessingDescription: 'We are extracting its text now. You can add another document while it is processing.', onboardingSelectTitle: 'Choose what to ask about.', onboardingSelectDescription: 'Select one or more ready files in your library. Only checked files are used as sources.', onboardingSelectHint: 'Choose a ready file in your library to ground your answers.', onboardingSelectCta: 'Select a source', onboardingExamples: 'Questions you can ask',
  stepSelect: 'Select sources', stepSelectDescription: 'Choose which files to include', stepAskDescription: 'Choose a prompt or write your own',
  eyebrow: 'YOUR RESEARCH, IN FOCUS', emptyTitle: 'A clearer way to work through documents.', questionTitle: 'What would you like to know?',
  askFindAcross: 'Ask a question and extractordinaire will find the answer across your {count}.',
  emptyDescription: 'Upload reports, papers, or meeting notes. Get answers with citations you can follow back to the source.',
  stepAdd: 'Add your sources', stepFormats: 'PDF and text files', stepAsk: 'Ask in plain English', stepAcross: 'Across all your files',
  stepCitations: 'Follow every citation', stepSource: 'Know where it came from', readyNote: 'Your documents are processed locally and stay in this browser.',
  promptTakeaways: 'Give me the key takeaways', promptRecommendations: 'What are the main recommendations?', promptDates: 'Find important dates and deadlines',
  yourLibrary: 'Your library', librarySubtitle: 'Ground answers in your files', ready: 'ready', dropFiles: 'Drop files to add them',
  selectDocument: 'Use {name} as a source', selectionHint: 'Select the files extractordinaire may read. No selection shares names only.', selectedFiles: '{count} selected',
  formatsLimit: 'PDF or TXT · Up to 10 MB each', browse: 'Browse', chooseFiles: 'Choose PDF or plain text files',
  libraryEmpty: 'Your documents will show up here.', working: 'Working', processing: 'Processing', indexing: 'Indexing locally', modelDownload: 'Preparing local search model', error: 'Error', removeDocument: 'Remove {name}',
  removeDocumentTitle: 'Remove {name} from your library', filesStayLocal: 'Files stay in this browser session',
  you: 'You', answer: 'ANSWER', thinking: 'Thinking…', stopGenerating: 'Stop generating',
  greetingReply: 'Hi! I’m extractordinaire. Select a document in your library and ask me what you’d like to know.',
  selectModel: 'Select a Gemini model',
  missingApiKey: 'Add GOOGLE_GENERATIVE_AI_API_KEY to .env.local to enable live answers.',
  askBeforeSending: 'Add a question before sending.', requestUnreadable: 'The request could not be read.',
  capacity: 'Gemini is temporarily at capacity. Please try again in a few minutes.',
  interrupted: 'Gemini’s request was interrupted. Try again, or ask about fewer or smaller documents.',
  rateLimited: 'Gemini is receiving too many requests. Try again shortly.', invalidKey: 'Google rejected the API key. Check that it is valid and enabled for the Gemini API.',
  modelUnavailable: 'The selected Gemini model is unavailable for this API project. Check GOOGLE_GENERATIVE_AI_MODEL.',
  networkBlocked: 'The app server cannot reach Gemini because outbound network access is blocked. Run the server in an environment that allows HTTPS access to Google.',
  connectGemini: 'The assistant could not connect to Gemini.', failedAnswer: 'The answer could not be generated. Please try again.',
  busy: 'The assistant is busy. Please try again in a moment.', responseUnavailable: 'The response stream was unavailable. Please try again.',
  connectionInterrupted: 'A connection issue interrupted the answer.', couldntFinish: 'I couldn’t finish that answer.',
  onlyPdfTxt: 'Only PDF and plain text files are supported.', tooLarge: 'This file is larger than the 10 MB limit.',
  unreadableFile: 'No readable text was found in this file.', fileReadFailed: 'We could not read this file.',
} as const;

type TranslationDictionary = { [Key in keyof typeof en]: string };

const es: TranslationDictionary = {
  openNavigation: 'Abrir navegación', closeNavigation: 'Cerrar navegación', navigation: 'Navegación y biblioteca de documentos',
  switchToLight: 'Cambiar al tema claro', switchToDark: 'Cambiar al tema oscuro', toggleLanguage: 'Cambiar idioma',
  newConversation: 'Nueva conversación', recent: 'RECIENTES', deleteConversation: 'Eliminar conversación',
  deleteConversationConfirm: '¿Eliminar “{title}”? Esta acción no se puede deshacer.',
  cancel: 'Cancelar',
  pdfPage: 'Página', previousPage: 'Página anterior', nextPage: 'Página siguiente', closePdfViewer: 'Cerrar el visor PDF',
  loadingPdf: 'Abriendo PDF…', pdfNotStored: 'El archivo PDF original no está disponible en este navegador. Elimínalo y vuelve a subirlo para abrir citas aquí.',
  pdfLoadFailed: 'No se pudo abrir este PDF.', pdfHighlightMissing: 'Se abrió la página citada, pero no se pudo resaltar el texto exacto.',
  workspace: 'Espacio de trabajo', sourceCount: '{count} fuente', sourceCountPlural: '{count} fuentes', noSources: 'Aún no hay fuentes',
  geminiStreaming: 'Gemini · en directo', conversationMessages: 'Mensajes de la conversación', askYourDocuments: 'Haz una pregunta sobre tus documentos',
  askAboutDocuments: 'Pregunta sobre tus documentos…', addDocumentFirst: 'Añade un documento y haz una pregunta…', sendMessage: 'Enviar mensaje',
  enterToSend: 'para enviar', shiftEnterNewline: 'para una nueva línea', groundedAnswers: 'Respuestas basadas en tus fuentes',
  onboardingProgress: 'Primeros pasos', onboardingUploadTitle: 'Empieza con un documento.', onboardingUploadDescription: 'Añade un archivo PDF o de texto. Buscaremos pasajes útiles y enlazaremos las respuestas con su origen.', onboardingUploadCta: 'Elegir documento', onboardingAddAnother: 'Añadir otro documento',
  onboardingProcessingTitle: 'Estamos preparando el documento.', onboardingProcessingDescription: 'Estamos extrayendo el texto. Puedes añadir otro documento mientras tanto.', onboardingSelectTitle: 'Elige sobre qué preguntar.', onboardingSelectDescription: 'Selecciona uno o varios archivos listos en tu biblioteca. Solo se usarán los archivos seleccionados.', onboardingSelectHint: 'Elige un archivo listo de tu biblioteca para basar tus respuestas.', onboardingSelectCta: 'Seleccionar fuente', onboardingExamples: 'Preguntas que puedes hacer',
  stepSelect: 'Seleccionar fuentes', stepSelectDescription: 'Elige qué archivos incluir', stepAskDescription: 'Elige una pregunta o escribe la tuya',
  eyebrow: 'INVESTIGA CON CLARIDAD', emptyTitle: 'Una forma más clara de revisar documentos.', questionTitle: '¿Qué te gustaría saber?',
  askFindAcross: 'Pregunta y extractordinaire encontrará la respuesta en {count}.',
  emptyDescription: 'Añade informes, artículos o notas de reuniones. Obtén respuestas con citas que enlazan con la fuente.',
  stepAdd: 'Añade tus fuentes', stepFormats: 'Archivos PDF y de texto', stepAsk: 'Pregunta en lenguaje natural', stepAcross: 'En todos tus archivos',
  stepCitations: 'Sigue cada cita', stepSource: 'Consulta su origen', readyNote: 'Los documentos se procesan localmente y permanecen en este navegador.',
  promptTakeaways: 'Resume las ideas principales', promptRecommendations: '¿Cuáles son las recomendaciones principales?', promptDates: 'Busca fechas y plazos importantes',
  yourLibrary: 'Tu biblioteca', librarySubtitle: 'Basa las respuestas en tus archivos', ready: 'listos', dropFiles: 'Suelta archivos para añadirlos',
  selectDocument: 'Usar {name} como fuente', selectionHint: 'Selecciona los archivos que extractordinaire puede leer. Sin selección solo se comparten los nombres.', selectedFiles: '{count} seleccionados',
  formatsLimit: 'PDF o TXT · Hasta 10 MB por archivo', browse: 'Explorar', chooseFiles: 'Elige archivos PDF o de texto',
  libraryEmpty: 'Tus documentos aparecerán aquí.', working: 'Procesando', processing: 'Procesando', indexing: 'Creando índice local', modelDownload: 'Preparando el modelo de búsqueda local', error: 'Error', removeDocument: 'Eliminar {name}',
  removeDocumentTitle: 'Eliminar {name} de tu biblioteca', filesStayLocal: 'Los archivos permanecen en este navegador',
  you: 'Tú', answer: 'RESPUESTA', thinking: 'Pensando…', stopGenerating: 'Detener la respuesta',
  greetingReply: '¡Hola! Soy extractordinaire. Selecciona un documento de tu biblioteca y pregúntame lo que quieras saber.',
  selectModel: 'Selecciona un modelo de Gemini',
  missingApiKey: 'Añade GOOGLE_GENERATIVE_AI_API_KEY a .env.local para activar las respuestas.',
  askBeforeSending: 'Escribe una pregunta antes de enviarla.', requestUnreadable: 'No se pudo leer la solicitud.',
  capacity: 'Gemini está temporalmente saturado. Inténtalo de nuevo en unos minutos.',
  interrupted: 'La solicitud a Gemini se interrumpió. Inténtalo de nuevo o pregunta sobre menos documentos.',
  rateLimited: 'Gemini está recibiendo demasiadas solicitudes. Inténtalo de nuevo pronto.', invalidKey: 'Google rechazó la clave de API. Comprueba que sea válida y esté habilitada para Gemini API.',
  modelUnavailable: 'Este modelo de Gemini no está disponible para tu proyecto. Comprueba GOOGLE_GENERATIVE_AI_MODEL.',
  networkBlocked: 'El servidor no puede conectarse con Gemini porque la red saliente está bloqueada. Permite el acceso HTTPS a Google.',
  connectGemini: 'El asistente no pudo conectarse con Gemini.', failedAnswer: 'No se pudo generar la respuesta. Inténtalo de nuevo.',
  busy: 'El asistente está ocupado. Inténtalo de nuevo en un momento.', responseUnavailable: 'La respuesta no está disponible. Inténtalo de nuevo.',
  connectionInterrupted: 'La conexión se interrumpió durante la respuesta.', couldntFinish: 'No pude terminar esa respuesta.',
  onlyPdfTxt: 'Solo se admiten archivos PDF y de texto sin formato.', tooLarge: 'El archivo supera el límite de 10 MB.',
  unreadableFile: 'No se encontró texto legible en este archivo.', fileReadFailed: 'No se pudo leer este archivo.',
};

export const dictionaries: Record<Locale, TranslationDictionary> = { en, es };
const localeStorageKey = 'clarity-locale';
const localeEvent = 'clarity-locale-change';

function getLocale(): Locale {
  return localStorage.getItem(localeStorageKey) === 'es' ? 'es' : 'en';
}

function subscribe(onChange: () => void) {
  window.addEventListener(localeEvent, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(localeEvent, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function setLocale(locale: Locale) {
  localStorage.setItem(localeStorageKey, locale);
  document.documentElement.lang = locale;
  window.dispatchEvent(new Event(localeEvent));
}

export function useI18n() {
  const locale = useSyncExternalStore(subscribe, getLocale, () => 'en' as Locale);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const toggleLocale = () => setLocale(locale === 'en' ? 'es' : 'en');
  return { locale, strings: dictionaries[locale], toggleLocale };
}

export function localizedError(key: keyof TranslationDictionary, locale: Locale) {
  return dictionaries[locale][key];
}
