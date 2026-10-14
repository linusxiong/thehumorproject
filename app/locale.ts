"use client";

import { useSyncExternalStore } from "react";
import { isAudienceId, type AudienceId } from "@/lib/jokes";

// The interface language doubles as the reader's language background: one choice drives both.
export type Locale = AudienceId;
export type Messages<T> = Record<Locale, T>;

export const brandName = "Punchline Passport";

// The brand as it appears in sentences and the header for each interface language.
export const localizedBrandName: Record<Locale, string> = { en: brandName, es: brandName, zh: "笑点护照" };

export const htmlLang: Record<Locale, string> = { en: "en", es: "es", zh: "zh-CN" };

// Names shown in the language switcher, always in their own language.
export const nativeNames: Record<Locale, string> = { en: "English", es: "Español", zh: "中文" };

// Audience names and cultures in the current interface language.
export const audienceNames: Messages<Record<AudienceId, string>> = {
  en: { en: "English", es: "Spanish", zh: "Chinese" },
  es: { en: "Inglés", es: "Español", zh: "Chino" },
  zh: { en: "英语", es: "西班牙语", zh: "中文" },
};

export const audienceCultures: Messages<Record<AudienceId, string>> = {
  en: { en: "The English-speaking world", es: "The Spanish-speaking world", zh: "Mainland China" },
  es: { en: "El mundo angloparlante", es: "El mundo hispanohablante", zh: "China continental" },
  zh: { en: "英语世界", es: "西班牙语世界", zh: "中国大陆" },
};

const storageKey = "locale";
const listeners = new Set<() => void>();

function browserLocale(): Locale {
  for (const language of navigator.languages ?? [navigator.language]) {
    const code = language.toLowerCase();
    if (code.startsWith("zh")) return "zh";
    if (code.startsWith("es")) return "es";
    if (code.startsWith("en")) return "en";
  }
  return "en";
}

// A saved choice wins; otherwise follow the browser's preferred languages.
function readLocale(): Locale {
  let stored: string | null = null;
  try { stored = localStorage.getItem(storageKey); } catch { /* Storage can be blocked; fall back to the browser languages. */ }
  return isAudienceId(stored) ? stored : browserLocale();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function setLocale(locale: Locale) {
  try { localStorage.setItem(storageKey, locale); } catch { /* Storage can be blocked; the choice then lasts until reload. */ }
  listeners.forEach((listener) => listener());
}

// The server always renders English; the client switches right after hydration.
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, readLocale, () => "en");
}
