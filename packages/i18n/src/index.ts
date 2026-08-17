// i18n compartido de SafeTag: instancia i18next + términos de dominio comunes
// (estados, semáforo, señales de alarma…) que ambas apps muestran a partir de
// los slugs estables guardados en la BD.
//
// Para sumar un idioma: crear locales/<lng>/common.json, añadirlo a
// SUPPORTED_LANGUAGES y a `resources`, y aportar los strings propios de cada
// app en su llamada a initI18n.
import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import esCommon from "./locales/es/common.json";

export const SUPPORTED_LANGUAGES = ["es"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const FALLBACK_LANGUAGE: SupportedLanguage = "es";

const common: Record<SupportedLanguage, object> = {
  es: esCommon,
};

/**
 * Inicializa i18next con los términos comunes más los recursos propios de la
 * app, por idioma. Los recursos de la app se montan en el namespace "app";
 * los comunes en "common" (namespace por defecto).
 *
 *   initI18n({ es: { title: "Cola de revisión" } })
 *   t("case.status.pending")        → común
 *   t("app:title")                  → de la app
 */
export function initI18n(
  appResources: Partial<Record<SupportedLanguage, object>> = {},
) {
  const resources = Object.fromEntries(
    SUPPORTED_LANGUAGES.map((lng) => [
      lng,
      { common: common[lng], app: appResources[lng] ?? {} },
    ]),
  );

  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: FALLBACK_LANGUAGE,
      supportedLngs: [...SUPPORTED_LANGUAGES],
      defaultNS: "common",
      interpolation: { escapeValue: false }, // React ya escapa
      detection: {
        order: ["localStorage", "navigator"],
        caches: ["localStorage"],
      },
    });

  return i18n;
}

export { default as i18n } from "i18next";
