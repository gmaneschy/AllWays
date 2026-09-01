// mobile/src/i18n/index.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';
import * as Localization from 'expo-localization';

const carregarJson = (req) => JSON.parse(JSON.stringify(req && req.default ? req.default : req));

// As pastas em disco mantêm a grafia usada no web (web/public/locales/):
// pt-BR, zh-Hans, zh-Hant — sem necessidade de renomear nada. O que
// importa é a CHAVE do objeto `resources` abaixo (o código de idioma que
// o i18next usa por dentro) — fica em minúsculo (pt-br, zh-hans, zh-hant)
// pra bater com settings.LANGUAGES do Django e com o <Selecionar> de
// PaginaConfiguracoes.jsx.
const resources = {
  'pt-br': {
    common: carregarJson(require('./locales/pt-BR/common.json')),
    users: carregarJson(require('./locales/pt-BR/users.json')),
    places: carregarJson(require('./locales/pt-BR/places.json')),
    itinerarios: carregarJson(require('./locales/pt-BR/itinerarios.json')),
    social: carregarJson(require('./locales/pt-BR/social.json')),
    feed: carregarJson(require('./locales/pt-BR/feed.json')),
    gamification: carregarJson(require('./locales/pt-BR/gamification.json')),
  },
  en: {
    common: carregarJson(require('./locales/en/common.json')),
    users: carregarJson(require('./locales/en/users.json')),
    places: carregarJson(require('./locales/en/places.json')),
    itinerarios: carregarJson(require('./locales/en/itinerarios.json')),
    social: carregarJson(require('./locales/en/social.json')),
    feed: carregarJson(require('./locales/en/feed.json')),
    gamification: carregarJson(require('./locales/en/gamification.json')),
  },
  es: {
    common: carregarJson(require('./locales/es/common.json')),
    users: carregarJson(require('./locales/es/users.json')),
    places: carregarJson(require('./locales/es/places.json')),
    itinerarios: carregarJson(require('./locales/es/itinerarios.json')),
    social: carregarJson(require('./locales/es/social.json')),
    feed: carregarJson(require('./locales/es/feed.json')),
    gamification: carregarJson(require('./locales/es/gamification.json')),
  },
  fr: {
    common: carregarJson(require('./locales/fr/common.json')),
    users: carregarJson(require('./locales/fr/users.json')),
    places: carregarJson(require('./locales/fr/places.json')),
    itinerarios: carregarJson(require('./locales/fr/itinerarios.json')),
    social: carregarJson(require('./locales/fr/social.json')),
    feed: carregarJson(require('./locales/fr/feed.json')),
    gamification: carregarJson(require('./locales/fr/gamification.json')),
  },
  de: {
    common: carregarJson(require('./locales/de/common.json')),
    users: carregarJson(require('./locales/de/users.json')),
    places: carregarJson(require('./locales/de/places.json')),
    itinerarios: carregarJson(require('./locales/de/itinerarios.json')),
    social: carregarJson(require('./locales/de/social.json')),
    feed: carregarJson(require('./locales/de/feed.json')),
    gamification: carregarJson(require('./locales/de/gamification.json')),
  },
  it: {
    common: carregarJson(require('./locales/it/common.json')),
    users: carregarJson(require('./locales/it/users.json')),
    places: carregarJson(require('./locales/it/places.json')),
    itinerarios: carregarJson(require('./locales/it/itinerarios.json')),
    social: carregarJson(require('./locales/it/social.json')),
    feed: carregarJson(require('./locales/it/feed.json')),
    gamification: carregarJson(require('./locales/it/gamification.json')),
  },
  'zh-hans': {
    common: carregarJson(require('./locales/zh-Hans/common.json')),
    users: carregarJson(require('./locales/zh-Hans/users.json')),
    places: carregarJson(require('./locales/zh-Hans/places.json')),
    itinerarios: carregarJson(require('./locales/zh-Hans/itinerarios.json')),
    social: carregarJson(require('./locales/zh-Hans/social.json')),
    feed: carregarJson(require('./locales/zh-Hans/feed.json')),
    gamification: carregarJson(require('./locales/zh-Hans/gamification.json')),
  },
  'zh-hant': {
    common: carregarJson(require('./locales/zh-Hant/common.json')),
    users: carregarJson(require('./locales/zh-Hant/users.json')),
    places: carregarJson(require('./locales/zh-Hant/places.json')),
    itinerarios: carregarJson(require('./locales/zh-Hant/itinerarios.json')),
    social: carregarJson(require('./locales/zh-Hant/social.json')),
    feed: carregarJson(require('./locales/zh-Hant/feed.json')),
    gamification: carregarJson(require('./locales/zh-Hant/gamification.json')),
  },
};

const IDIOMAS_SUPORTADOS = Object.keys(resources);
const CHAVE_IDIOMA_SECURESTORE = 'idioma';

function normalizarIdioma(languageTag) {
  const tag = (languageTag ?? 'pt-BR').toLowerCase();
  if (tag.startsWith('zh')) {
    return tag.includes('hant') || tag.includes('-tw') || tag.includes('-hk') ? 'zh-hant' : 'zh-hans';
  }
  if (tag.startsWith('pt')) return 'pt-br';
  const idioma = tag.split('-')[0];
  return IDIOMAS_SUPORTADOS.includes(idioma) ? idioma : 'pt-br';
}

// Localization.getLocales() é SÍNCRONO (diferente do SecureStore) —
// resolve na hora, sem Promise, sem risco de travar o init. É por isso
// que a versão anterior quebrava: o init inteiro dependia de uma Promise
// (SecureStore) resolver antes de QUALQUER t() funcionar; se aquilo
// travasse ou demorasse (module não pronto no boot, etc.), toda tela
// ficava mostrando a chave crua pra sempre, não só por um instante.
let idiomaInicial;
try {
  idiomaInicial = normalizarIdioma(Localization.getLocales()[0]?.languageTag);
} catch {
  idiomaInicial = 'pt-br';
}

i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v3',
    resources,
    lng: idiomaInicial, // síncrono — t() funciona desde a primeira renderização
    fallbackLng: 'pt-br',
    supportedLngs: IDIOMAS_SUPORTADOS,
    lowerCaseLng: true,
    ns: ['common', 'users', 'places', 'itinerarios', 'social', 'feed', 'gamification'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

// A preferência salva (SecureStore) tem prioridade sobre o idioma do
// sistema, mas só é aplicada DEPOIS do init síncrono acima — troca o
// idioma já com o app renderizado, em vez de bloquear a primeira tela.
// Chamada uma vez no boot, a partir de App.js.
export async function aplicarIdiomaSalvo() {
  try {
    const salvo = await SecureStore.getItemAsync(CHAVE_IDIOMA_SECURESTORE);
    if (salvo && IDIOMAS_SUPORTADOS.includes(salvo) && salvo !== i18n.language) {
      await i18n.changeLanguage(salvo);
    }
  } catch {
    // Sem SecureStore disponível — mantém o idioma do sistema já aplicado
    // no init síncrono. Não é um estado de erro, só significa "sem
    // preferência salva ainda".
  }
}

// Sem um LanguageDetector plugin (removido de propósito — ver comentário
// acima), a persistência da escolha feita em PaginaConfiguracoes precisa
// ser ouvida manualmente aqui.
i18n.on('languageChanged', (lng) => {
  SecureStore.setItemAsync(CHAVE_IDIOMA_SECURESTORE, lng).catch(() => {});
});

export default i18n;