import { AnimatePresence, motion } from 'framer-motion';
import { IconeAlerta } from './icons';
import './Avisos.css';

/*
  Avisos.jsx — modais de confirmação ("tem certeza?") do AllWays.

  Existe pra substituir window.confirm/window.alert espalhados pelo código
  por algo com a cara do app (tokens de theme.css) e transição consistente
  (fade + scale, easeInOut, via framer-motion). ModalConfirmacao é o
  componente genérico; abaixo dele ficam wrappers finos, pré-configurados
  por ação/contexto (título, mensagem, cor do botão já resolvidos), pra
  quem for usar não precisar redigitar o texto toda vez que a mesma
  confirmação aparecer em mais de uma página.

  Como adicionar um aviso novo: escreva um componente pequeno que só passa
  props fixas pro ModalConfirmacao, do jeito que AvisoExcluirRascunho faz.
*/

/** Modal de confirmação genérico. Controlado pelo pai via `aberto` — o
 * próprio componente não guarda estado nenhum, só decide o que mostrar.
 *
 * `carregando` desabilita os dois botões e troca o texto do de confirmar
 * (útil enquanto a ação em si — ex: a chamada à API — está em andamento).
 */
function ModalConfirmacao({
  aberto,
  titulo,
  mensagem,
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  perigo = false,
  carregando = false,
  onConfirmar,
  onCancelar,
}) {
  return (
    <AnimatePresence>
      {aberto && (
        <motion.div
          className="aviso-overlay"
          onClick={carregando ? undefined : onCancelar}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeInOut' }}
        >
          <motion.div
            className="aviso-box"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <div className={`aviso-box__icone${perigo ? ' aviso-box__icone--perigo' : ''}`}>
              <IconeAlerta size={22} />
            </div>

            <h2 className="aviso-box__titulo">{titulo}</h2>
            <p className="aviso-box__mensagem">{mensagem}</p>

            <div className="aviso-box__acoes">
              <button
                onClick={onCancelar}
                disabled={carregando}
                className="aviso-box__botao aviso-box__botao--cancelar"
              >
                {textoCancelar}
              </button>
              <button
                onClick={onConfirmar}
                disabled={carregando}
                className={`aviso-box__botao${perigo ? ' aviso-box__botao--perigo' : ' aviso-box__botao--primario'}`}
              >
                {carregando ? 'Aguarde...' : textoConfirmar}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Avisos pré-configurados por ação ──────────────────────────────────

/** Confirmação de exclusão de rascunho — usado hoje no CardItinerarioResumo
 * (grid de rascunhos do perfil). `carregando` deve refletir o estado de
 * "excluindo" de quem chama, pra desabilitar os botões durante a chamada
 * à API. */
export function AvisoExcluirRascunho({ aberto, carregando, onConfirmar, onCancelar }) {
  return (
    <ModalConfirmacao
      aberto={aberto}
      titulo="Excluir rascunho"
      mensagem="Tem certeza de que deseja excluir este rascunho? Essa ação não pode ser desfeita."
      textoConfirmar="Excluir"
      perigo
      carregando={carregando}
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
    />
  );
}

/** Confirmação de exclusão de um itinerário (usado no dropdown "Mais
 * opções" da PaginaItinerario, só visível pro autor). Mensagem própria,
 * diferente da de rascunho — aqui já pode existir curtidas e comentários
 * de outras pessoas, que se perdem junto. */
export function AvisoExcluirItinerario({ aberto, carregando, onConfirmar, onCancelar }) {
  return (
    <ModalConfirmacao
      aberto={aberto}
      titulo="Excluir itinerário"
      mensagem="Tem certeza de que deseja excluir este itinerário? Curtidas e comentários também serão perdidos, e essa ação não pode ser desfeita."
      textoConfirmar="Excluir"
      perigo
      carregando={carregando}
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
    />
  );
}

/** Confirmação de remoção de um ponto do itinerário em criação — usado na
 * CriarItinerario, junto ao ícone de upload de mídia do card do ponto
 * ativo. Diferente dos avisos de exclusão acima: aqui nada foi publicado
 * ainda, então o que se perde é só o preenchimento local daquele ponto
 * (campos e mídias já adicionadas), não curtidas/comentários de terceiros. */
export function AvisoRemoverPonto({ aberto, onConfirmar, onCancelar }) {
  return (
    <ModalConfirmacao
      aberto={aberto}
      titulo="Remover ponto"
      mensagem="Tem certeza de que deseja remover este ponto do itinerário? Os dados preenchidos e as mídias adicionadas para ele serão perdidos."
      textoConfirmar="Remover"
      perigo
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
    />
  );
}

/** Confirmação de exclusão de comentário ou resposta — usado no FeedCard e
 * na PaginaItinerario, antes de disparar a chamada de apagar. É a mesma
 * chamada de API pros dois casos (thread de 1 nível só), então um único
 * componente resolve — `ehResposta` só ajusta o texto pra ficar claro o
 * que está sendo removido. */
export function AvisoExcluirComentario({ aberto, ehResposta = false, carregando, onConfirmar, onCancelar }) {
  return (
    <ModalConfirmacao
      aberto={aberto}
      titulo={ehResposta ? 'Excluir resposta' : 'Excluir comentário'}
      mensagem={`Tem certeza de que deseja excluir ${ehResposta ? 'esta resposta' : 'este comentário'}? Essa ação não pode ser desfeita.`}
      textoConfirmar="Excluir"
      perigo
      carregando={carregando}
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
    />
  );
}

/** Confirmação de logout (Navbar). Não usa `perigo` — sair da conta não é
 * uma ação destrutiva como excluir algo, é só encerrar a sessão atual, e
 * o usuário loga de volta a hora que quiser. */
export function AvisoSair({ aberto, onConfirmar, onCancelar }) {
  return (
    <ModalConfirmacao
      aberto={aberto}
      titulo="Sair da conta"
      mensagem="Tem certeza de que deseja sair?"
      textoConfirmar="Sair"
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
    />
  );
}

export default ModalConfirmacao;