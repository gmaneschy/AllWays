import { Pressable, Text, StyleSheet } from 'react-native';
import { cloneElement, isValidElement } from 'react';
import { cores, fontes } from '../theme';

/*
  Botao.jsx — porte de buttons.css.

  'primario', 'outline', 'outlineAtivo' (.btn-outline--ativo) e
  'outlineCurtido' (.btn-outline--curtido) vêm direto do arquivo.

  'perigo' e 'cancelar' foram ADICIONADAS aqui, além do que buttons.css
  cobre — Avisos.css já usava exatamente esses dois padrões (botão de ação
  destrutiva e botão neutro de cancelar) nos próprios modais de
  confirmação, e não fazia sentido ter esse visual só implementado
  localmente ali. Reaproveitei os tokens de cor que já existem (cores.perigo,
  cores.perigoHover) em vez de inventar algo novo — mas veio de outro
  arquivo CSS, não de buttons.css, então fica registrado aqui.

  RN não tem :hover — os estados de "pressionado" abaixo reaproveitam os
  mesmos tokens que o CSS usava no :hover de cada variante (mesma lógica
  já usada em AvisoOffline/EstadoErro).
*/
const VARIANTES = {
  primario: {
    container: { backgroundColor: cores.primaria, borderWidth: 0, paddingHorizontal: 16 },
    pressionado: { backgroundColor: cores.primariaHover },
    texto: { color: cores.branco, fontWeight: 'bold' },
  },
  outline: {
    container: { backgroundColor: cores.fundoCard, borderWidth: 1, borderColor: cores.bordaPadrao, paddingHorizontal: 14 },
    pressionado: { backgroundColor: cores.fundoHover },
    texto: { color: cores.textoSecundario, fontWeight: 'normal' },
  },
  outlineAtivo: {
    container: { backgroundColor: cores.primariaFundo, borderWidth: 1, borderColor: cores.primaria, paddingHorizontal: 14 },
    texto: { color: cores.primaria, fontWeight: 'bold' },
  },
  outlineCurtido: {
    container: { backgroundColor: cores.fundoCard, borderWidth: 1, borderColor: cores.bordaPadrao, paddingHorizontal: 14 },
    pressionado: { backgroundColor: cores.fundoHover },
    texto: { color: cores.perigo, fontWeight: 'normal' },
  },
  // ─── Extras (ver comentário acima) ─────────────────────────────────
  perigo: {
    container: { backgroundColor: cores.perigo, borderWidth: 0, paddingHorizontal: 16 },
    pressionado: { backgroundColor: cores.perigoHover },
    texto: { color: cores.branco, fontWeight: 'bold' },
  },
  cancelar: {
    container: { backgroundColor: cores.fundoHover, borderWidth: 1, borderColor: cores.bordaPadrao, paddingHorizontal: 16 },
    pressionado: { backgroundColor: cores.bordaSutil },
    texto: { color: cores.textoPrincipal, fontWeight: 'bold' },
  },
  // .config-btn-perigo-contorno de PaginaConfiguracoes.css
  perigoContorno: {
    container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: cores.perigo, paddingHorizontal: 16 },
    pressionado: { backgroundColor: cores.perigoFundoSuave },
    texto: { color: cores.perigo, fontWeight: 'bold' },
  },
};

/**
 * Botão compartilhado. Uso básico:
 *   <Botao variante="primario" onPress={salvar}>Salvar</Botao>
 *
 * Com ícone (colorido automaticamente pra combinar com o texto, a menos
 * que você já tenha passado uma `color` explícita no ícone):
 *   <Botao variante="outline" icone={<IconeSalvar size={16} />}>Salvar rascunho</Botao>
 */
function Botao({ variante = 'primario', disabled = false, onPress, icone, children, style, textoStyle, ...props }) {
  const v = VARIANTES[variante] ?? VARIANTES.primario;
  const iconeColorido = isValidElement(icone) && icone.props.color === undefined
    ? cloneElement(icone, { color: v.texto.color })
    : icone;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        estilos.base,
        v.container,
        pressed && !disabled && (v.pressionado ?? estilos.pressionadoFallback),
        disabled && estilos.desabilitado,
        style,
      ]}
      {...props}
    >
      {iconeColorido}
      {typeof children === 'string'
        ? <Text style={[estilos.texto, v.texto, textoStyle]}>{children}</Text>
        : children}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: 8,
  },
  pressionadoFallback: {
    opacity: 0.85,
  },
  desabilitado: {
    opacity: 0.6,
  },
  texto: {
    ...fontes.meta,
  },
});

export default Botao;