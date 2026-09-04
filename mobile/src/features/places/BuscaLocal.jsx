import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import api from '../../api/api';
import { IconeSucesso, IconeTrocar } from '../../components/icons';
import { cores, fontes } from '../../theme';

const DEBOUNCE_MS = 400;

function BuscaLocal({ onSelecionar, localSelecionado }) {
  const { t } = useTranslation('places');
  const [texto, setTexto] = useState('');
  const [sugestoes, setSugestoes] = useState([]);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (texto.length < 3) { setSugestoes([]); return undefined; }

    timeoutRef.current = setTimeout(async () => {
      try {
        const resposta = await api.get('/places/autocomplete/', { params: { q: texto } });
        setSugestoes(resposta.data);
      } catch (err) {
        console.error('Erro ao buscar sugestões:', err.message);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeoutRef.current);
  }, [texto]);

  async function escolherSugestao(placeId, descricao) {
    setSugestoes([]);
    setTexto(descricao);
    try {
      const resposta = await api.post('/places/', { place_id: placeId });
      onSelecionar(resposta.data);
    } catch (err) {
      console.error('Erro ao salvar local:', err.message);
    }
  }

  if (localSelecionado) {
    return (
      <View style={estilos.selecionado}>
        <IconeSucesso size={16} color={cores.primaria} />
        <Text style={estilos.selecionadoTexto} numberOfLines={1}>{localSelecionado.nome}</Text>
        <Pressable onPress={() => onSelecionar(null)} style={estilos.trocar} hitSlop={8}>
          <IconeTrocar size={13} color={cores.textoSecundario} />
          <Text style={estilos.trocarTexto}>{t('busca_local.trocar')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={estilos.container}>
      <TextInput
        value={texto}
        onChangeText={setTexto}
        placeholder={t('busca_local.placeholder')}
        placeholderTextColor={cores.textoMuted}
        style={estilos.input}
      />
      {sugestoes.length > 0 && (
        <View style={estilos.dropdown}>
          {sugestoes.map((s) => (
            <Pressable
              key={s.place_id}
              onPress={() => escolherSugestao(s.place_id, s.descricao)}
              style={({ pressed }) => [estilos.sugestao, pressed && estilos.sugestaoPressionada]}
            >
              <Text style={estilos.sugestaoTexto} numberOfLines={2}>{s.descricao}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { position: 'relative', zIndex: 20 },
  input: {
    borderWidth: 1, borderColor: cores.bordaPadrao, borderRadius: 8,
    padding: 10, ...fontes.corpo, color: cores.textoPrincipal,
  },
  dropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
    backgroundColor: cores.fundoCard, borderWidth: 1, borderColor: cores.bordaPadrao,
    borderRadius: 8, maxHeight: 220, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 6,
  },
  sugestao: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: cores.bordaSutil },
  sugestaoPressionada: { backgroundColor: cores.fundoHover },
  sugestaoTexto: { ...fontes.corpo, color: cores.textoPrincipal },
  selecionado: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderWidth: 1, borderColor: cores.bordaPadrao, borderRadius: 8 },
  selecionadoTexto: { ...fontes.corpo, color: cores.textoPrincipal, flex: 1 },
  trocar: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trocarTexto: { ...fontes.meta, color: cores.textoSecundario },
});

export default BuscaLocal;