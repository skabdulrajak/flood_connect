import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getIntlLocale,
  LANGUAGE_STORAGE_KEY,
  normalizeLanguageCode,
  SUPPORTED_LANGUAGES,
} from '../i18n';
import { useAuth } from './useAuth';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const { i18n } = useTranslation();
  const { isAuthenticated, user, profile, updateProfile } = useAuth();
  const syncedUserIdRef = useRef(null);

  const language = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language || 'en');
  const intlLocale = useMemo(() => getIntlLocale(language), [language]);

  // Keep <html lang="..."> synced whenever language changes
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  // On user login (or session restore), load profile.preferred_language into i18n
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      syncedUserIdRef.current = null;
      return;
    }
    const profileLang = profile?.preferred_language
      ? normalizeLanguageCode(profile.preferred_language)
      : null;

    if (profileLang && syncedUserIdRef.current !== user.id) {
      syncedUserIdRef.current = user.id;
      if (profileLang !== language) {
        i18n.changeLanguage(profileLang);
        try {
          window.localStorage.setItem(LANGUAGE_STORAGE_KEY, profileLang);
        } catch {
          // Ignore storage errors
        }
      }
    }
  }, [isAuthenticated, user?.id, profile?.preferred_language, i18n, language]);

  const setLanguage = useCallback(
    async (nextLang, { persistToProfile = true } = {}) => {
      const normalized = normalizeLanguageCode(nextLang);
      await i18n.changeLanguage(normalized);

      try {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
      } catch {
        // Ignore storage errors
      }

      if (typeof document !== 'undefined') {
        document.documentElement.lang = normalized;
      }

      if (persistToProfile && isAuthenticated && user?.id && profile?.preferred_language !== normalized) {
        try {
          await updateProfile({ preferred_language: normalized });
        } catch {
          // Non-blocking: UI language remains active locally even if remote profile sync fails
        }
      }

      return normalized;
    },
    [i18n, isAuthenticated, user?.id, profile?.preferred_language, updateProfile]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      intlLocale,
      languages: SUPPORTED_LANGUAGES,
    }),
    [language, setLanguage, intlLocale]
  );

  return createElement(LanguageContext.Provider, { value }, children);
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used inside LanguageProvider.');
  }
  return ctx;
}
