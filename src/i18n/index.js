import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import hi from './locales/hi.json';
import te from './locales/te.json';

export const LANGUAGE_STORAGE_KEY = 'floodconnect_lang';

export const SUPPORTED_LANGUAGES = Object.freeze([
  { code: 'en', label: 'English', nativeLabel: 'English', intlLocale: 'en-IN' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', intlLocale: 'hi-IN' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు', intlLocale: 'te-IN' },
]);

export const SUPPORTED_LANGUAGE_CODES = Object.freeze(
  SUPPORTED_LANGUAGES.map((item) => item.code)
);

export function normalizeLanguageCode(raw) {
  if (!raw || typeof raw !== 'string') return 'en';
  const base = raw.trim().toLowerCase().split('-')[0];
  return SUPPORTED_LANGUAGE_CODES.includes(base) ? base : 'en';
}

export function getIntlLocale(lang) {
  const code = normalizeLanguageCode(lang || i18n.resolvedLanguage || i18n.language || 'en');
  return SUPPORTED_LANGUAGES.find((item) => item.code === code)?.intlLocale || 'en-IN';
}

function syncDocumentLang(lang) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = normalizeLanguageCode(lang);
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      te: { translation: te },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'hi', 'te'],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    returnEmptyString: false,
    returnNull: false,
    interpolation: {
      escapeValue: false, // React already escapes rendered values
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
  });

syncDocumentLang(i18n.resolvedLanguage || i18n.language || 'en');

i18n.on('languageChanged', (lng) => {
  const normalized = normalizeLanguageCode(lng);
  syncDocumentLang(normalized);
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
  } catch {
    // Ignore storage access errors in restricted iframes
  }
});

export default i18n;
