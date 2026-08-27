import { cookies } from "next/headers";
import { LOCALE_COOKIE, translations, translate, type Locale } from "./translations";

/** Read the persisted locale from the request cookie (default: English). */
export async function getLocaleFromCookies(): Promise<Locale> {
  try {
    const store = await cookies();
    const v = store.get(LOCALE_COOKIE)?.value;
    return v === "ms" || v === "zh-CN" ? v : "en";
  } catch {
    return "en";
  }
}

/**
 * Server-side translation helper for server components. Returns a `t()`
 * bound to the current request's locale (from the cookie set by the client).
 */
export async function getTranslations(): Promise<{
  locale: Locale;
  t: (key: string, vars?: Record<string, string | number>) => string;
}> {
  const locale = await getLocaleFromCookies();
  const dict = translations[locale];
  return {
    locale,
    t: (key, vars) => translate(dict, key, vars),
  };
}
