"use client";

import { useI18n } from "@/lib/i18n";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/translations";
import { cx } from "@/lib/format";

/**
 * Dropdown that toggles the app language (English default, Bahasa Malaysia,
 * Simplified Chinese). Choice is persisted and survives reloads/navigation.
 *
 * `variant` styles the control for light surfaces (e.g. the header) or dark
 * surfaces (e.g. the sidebar / login screen).
 */
export function LanguageSwitcher({ variant = "light" }: { variant?: "light" | "dark" }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <label
      className={cx(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold shadow-sm transition",
        variant === "light"
          ? "border border-slate-200 bg-white text-slate-600"
          : "bg-white/5 text-blue-200 ring-1 ring-white/10",
      )}
      title={t("language.switchTo")}
    >
      <span className="sr-only">{t("language.label")}</span>
      <i className="fa-solid fa-globe text-[11px] opacity-70" />
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        aria-label={t("language.label")}
        className={cx(
          "cursor-pointer bg-transparent text-xs font-semibold focus:outline-none",
          variant === "light" ? "text-slate-600" : "text-blue-200 [&>option]:text-slate-800",
        )}
      >
        {SUPPORTED_LOCALES.map((l) => (
          <option key={l.value} value={l.value}>
            {l.native}
          </option>
        ))}
      </select>
    </label>
  );
}
