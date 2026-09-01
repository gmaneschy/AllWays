import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { IconeSucesso } from './icons';
import { cores, fontes } from '../theme';

/*
  Formulario.jsx — porte de forms.css.

  ATUALIZAÇÃO: o comentário original dizia que um componente de <select>
  ficaria pra quando a Fase 8 (CriarItinerario) precisasse dele. Acabou
  não dando pra esperar — o cadastro do Login (Fase 2) já tem um campo de
  gênero que precisa disso. Resolvido com @react-native-picker/picker (a
  lib padrão do ecossistema RN/Expo pra isso: dropdown nativo no Android,
  roda de seleção em modal no iOS) em vez de inventar um bottom sheet
  customizado. Ver <Selecionar> abaixo — a Fase 8 reaproveita o mesmo
  componente.
*/


export function Rotulo({ children, style }) {
  return <Text style={[estilos.rotulo, style]}>{children}</Text>;
}

function useFoco() {
  const [focado, setFocado] = useState(false);
  return { focado, aoFocar: () => setFocado(true), aoDesfocar: () => setFocado(false) };
}

export function CampoTexto({ rotulo, comEspacamento = true, style, onFocus, onBlur, ...props }) {
  const { focado, aoFocar, aoDesfocar } = useFoco();
  return (
    <View style={[estilos.grupo, !comEspacamento && estilos.semEspaco]}>
      {rotulo && <Rotulo>{rotulo}</Rotulo>}
      <TextInput
        placeholderTextColor={cores.textoMuted}
        onFocus={(e) => { aoFocar(); onFocus?.(e); }}
        onBlur={(e) => { aoDesfocar(); onBlur?.(e); }}
        style={[estilos.campo, focado && estilos.campoFocado, style]}
        {...props}
      />
    </View>
  );
}

export function AreaTexto({ rotulo, numberOfLines = 4, comEspacamento = true, style, onFocus, onBlur, ...props }) {
  const { focado, aoFocar, aoDesfocar } = useFoco();
  return (
    <View style={[estilos.grupo, !comEspacamento && estilos.semEspaco]}>
      {rotulo && <Rotulo>{rotulo}</Rotulo>}
      <TextInput
        multiline
        numberOfLines={numberOfLines}
        textAlignVertical="top" // Android: sem isso o texto começa centralizado verticalmente na caixa
        placeholderTextColor={cores.textoMuted}
        onFocus={(e) => { aoFocar(); onFocus?.(e); }}
        onBlur={(e) => { aoDesfocar(); onBlur?.(e); }}
        style={[estilos.campo, estilos.areaTexto, focado && estilos.campoFocado, style]}
        {...props}
      />
    </View>
  );
}

// forms.css só estiliza o WRAPPER (.form-checkbox-label — flex + gap); a
// caixinha em si era o checkbox nativo do navegador, sem regra própria.
// RN não tem esse elemento nativo, então a caixa 20x20 abaixo (borda,
// radius, preenchimento quando marcado) é uma adição minha pra dar
// feedback visual — não veio do CSS, é só o mínimo pra ficar usável.
export function CampoCheckbox({ valor, aoAlterar, children, disabled = false, alinharTopo = false }) {
  return (
    <Pressable
      onPress={() => !disabled && aoAlterar?.(!valor)}
      disabled={disabled}
      style={[estilos.checkboxLinha, alinharTopo && estilos.checkboxLinhaTopo, disabled && estilos.desabilitado]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: valor, disabled }}
    >
      <View style={[estilos.checkboxCaixa, alinharTopo && estilos.checkboxCaixaTopo, valor && estilos.checkboxCaixaMarcada]}>
        {valor && <IconeSucesso size={14} color={cores.branco} strokeWidth={3} />}
      </View>
      <Text style={estilos.checkboxTexto}>{children}</Text>
    </Pressable>
  );
}

// forms.css também não definia nada pro radio nativo do navegador — mesma
// situação do checkbox acima. `selecionado` é controlado por quem chama
// (o "grupo" de radio não existe como componente à parte; cada opção é um
// CampoRadio independente, igual o próprio JSX do web fazia com <input
// type="radio"> um a um dentro de um .map()).
export function CampoRadio({ selecionado, aoSelecionar, children, disabled = false }) {
  return (
    <Pressable
      onPress={() => !disabled && aoSelecionar?.()}
      disabled={disabled}
      style={[estilos.checkboxLinha, disabled && estilos.desabilitado]}
      accessibilityRole="radio"
      accessibilityState={{ selected: selecionado, disabled }}
    >
      <View style={[estilos.radioCirculo, selecionado && estilos.radioCirculoSelecionado]}>
        {selecionado && <View style={estilos.radioPonto} />}
      </View>
      <Text style={estilos.checkboxTexto}>{children}</Text>
    </Pressable>
  );
}

/** Equivalente ao <select> do web. `opcoes` no formato
 * [{ value, label }, ...] — mesmo shape que os arrays MOVIMENTACAO_OPCOES/
 * MEIO_DESLOCAMENTO_OPCOES do web já usam (só falta trocar `labelKey`
 * resolvido via t() por `label` antes de passar pra cá). */
export function Selecionar({ rotulo, valor, aoAlterar, opcoes, style, ...props }) {
  return (
    <View style={estilos.grupo}>
      {rotulo && <Rotulo>{rotulo}</Rotulo>}
      <View style={[estilos.campo, estilos.pickerCaixa, style]}>
        <Picker selectedValue={valor} onValueChange={aoAlterar} {...props}>
          {opcoes.map((o) => (
            <Picker.Item key={String(o.value)} label={o.label} value={o.value} />
          ))}
        </Picker>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: {
    marginBottom: 12, // equivalente ao margin-bottom:12px que .form-input tinha no web
  },
  semEspaco: {
    marginBottom: 0,
  },
  rotulo: {
    ...fontes.meta,
    color: cores.textoSecundario,
    marginBottom: 6,
  },
  campo: {
    width: '100%',
    padding: 8,
    fontSize: fontes.corpo.fontSize,
    color: cores.textoPrincipal,
    backgroundColor: cores.fundoCard,
    borderWidth: 1,
    borderColor: cores.bordaPadrao,
    borderRadius: 6,
  },
  campoFocado: {
    borderColor: cores.primaria, // equivalente ao :focus do web — RN não tem outline
  },
  // O Picker.js do RN já vem com o padding interno controlado pelo SO —
  // aqui só a moldura (borda/radius/fundo) precisa bater com .form-select;
  // overflow:hidden evita o conteúdo do Picker vazar pra fora do radius
  // no Android.
  pickerCaixa: {
    padding: 0,
    overflow: 'hidden',
  },
  areaTexto: {
    minHeight: 96,
  },
  checkboxLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // Usado quando o texto ao lado pode quebrar em 2+ linhas (ex: checkbox
  // de confirmação de exclusão de conta) — sem isso a caixinha fica
  // centralizada no meio do bloco de texto em vez de alinhada com a
  // primeira linha, igual ao align-items:flex-start do
  // .config-checkbox-confirmacao no web.
  checkboxLinhaTopo: {
    alignItems: 'flex-start',
  },
  checkboxCaixa: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: cores.bordaPadrao,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCaixaTopo: {
    marginTop: 2, // mesmo ajuste fino do margin-top:2px do CSS original
  },
  checkboxCaixaMarcada: {
    backgroundColor: cores.primaria,
    borderColor: cores.primaria,
  },
  checkboxTexto: {
    ...fontes.corpo,
    color: cores.textoPrincipal,
    flex: 1, // permite o texto quebrar linha em vez de espremer a Pressable
  },
  radioCirculo: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: cores.bordaPadrao,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCirculoSelecionado: {
    borderColor: cores.primaria,
  },
  radioPonto: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: cores.primaria,
  },
  desabilitado: {
    opacity: 0.6,
  },
});