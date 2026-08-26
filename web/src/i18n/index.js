// web/src/i18n/index.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend'; // carrega os JSONs sob demanda, não no bundle inicial

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'pt-BR',
    supportedLngs: ['pt-BR', 'en', 'es', 'fr', 'de', 'it', 'zh-Hans', 'zh-Hant'],
    ns: ['common', 'users', 'places', 'itinerarios', 'social', 'feed', 'gamification'],
    defaultNS: 'common',
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    detection: {
      // ordem: preferência salva explicitamente > idioma do navegador
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false }, // React já escapa por padrão
  });

export default i18n;