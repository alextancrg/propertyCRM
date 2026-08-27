"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  LOCALE_COOKIE,
  translations,
  translate,
  type Dictionary,
  type Locale,
} from "./translations";

export const LOCALE_STORAGE_KEY = "assethub:locale";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Translate a dotted key, e.g. t("dashboard.waLeft", { left, limit }). Falls back to English. */
  t: (key: string, vars?: Record<string, string | number>) => string;
  dict: Dictionary;
};

const I18nContext = createContext<I18nContextValue>({
  locale: "en",
  setLocale: () => {},
  t: (key) => key,
  dict: translations.en,
});

/**
 * Provides the active UI locale to the whole app. English is the default.
 * The choice is persisted to localStorage (client) and a cookie (server-side
 * initial render), so a reload or a server render keeps the same language.
 */
export function LocaleProvider({
  children,
  initialLocale = "en",
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // After hydration, honour a stored preference (localStorage wins over the
  // cookie captured during SSR).
  useEffect(() => {
    let stored: Locale | null = null;
    try {
      const v = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (v === "en" || v === "ms" || v === "zh-CN") stored = v;
    } catch {
      // storage unavailable — keep initial locale
    }
    if (stored) setLocaleState(stored);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // ignore
    }
    try {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      // ignore
    }
    // Keep <html lang> in sync for a11y and translation tooling.
    if (typeof document !== "undefined") document.documentElement.lang = next;
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, vars) => translate(translations[locale], key, vars),
      dict: translations[locale],
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
