module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // 'react-native-reanimated/plugin' precisa ser SEMPRE o último item
    // da lista — usado desde a Fase 1 (Avisos.jsx, theme/animacoes.js) e
    // esse arquivo ainda não existia.
    plugins: ['react-native-reanimated/plugin'],
  };
};
