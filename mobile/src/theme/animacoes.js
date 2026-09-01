// mobile/src/theme/animacoes.js
import { useEffect } from 'react';
import { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';

// Equivalente ao @keyframes girar + .icone-girando do theme.css (usado
// pelo IconeCarregando via className). RN não tem CSS animation — isso
// vira um hook que devolve um style animado pra aplicar num Animated.View
// envolvendo o ícone.
//
// Uso:
//   const estiloGiro = useGirar();
//   <Animated.View style={estiloGiro}><IconeCarregando /></Animated.View>
export function useGirar() {
  const rotacao = useSharedValue(0);

  useEffect(() => {
    rotacao.value = withRepeat(
      withTiming(360, { duration: 800, easing: Easing.linear }), // mesma duração do CSS original (0.8s linear)
      -1, // repete infinitamente
      false,
    );
  }, [rotacao]);

  return useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotacao.value}deg` }],
  }));
}
