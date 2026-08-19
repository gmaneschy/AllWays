import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getConfiguracoes, atualizarConfiguracoes, alterarSenha,
  desativarConta, excluirConta, logout,
} from './api';
import { IconeAlerta, IconeSucesso } from './icons';
import './PaginaConfiguracoes.css';

const DURACOES_DESATIVACAO = [
  { valor: 7, label: '7 dias' },
  { valor: 15, label: '15 dias' },
  { valor: 30, label: '30 dias' },
  { valor: null, label: 'Indefinidamente' },
];

/** Switch on/off — puramente visual, quem decide o que "ligado" significa
 * é sempre quem chama (ver as duas exibições invertidas na seção Exibição). */
function ConfigToggle({ checked, onChange, disabled }) {
  return (
    <label className={`config-toggle${disabled ? ' config-toggle--desabilitado' : ''}`}>
      <input type="checkbox" checked={!!checked} disabled={disabled} onChange={onChange} />
      <span className="config-toggle__trilho" />
    </label>
  );
}

function LinhaToggle({ label, ajuda, checked, onChange, disabled }) {
  return (
    <div className="config-linha">
      <div className="config-linha__texto">
        <p className="config-linha__label">{label}</p>
        {ajuda && <p className="config-linha__ajuda">{ajuda}</p>}
      </div>
      <ConfigToggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function PaginaConfiguracoes() {
  const navigate = useNavigate();

  const [config, setConfig] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [senhaErro, setSenhaErro] = useState(null);
  const [senhaSucesso, setSenhaSucesso] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  // --- Desativar conta ---
  const [mostrarDesativar, setMostrarDesativar] = useState(false);
  const [senhaDesativar, setSenhaDesativar] = useState('');
  const [duracaoDesativar, setDuracaoDesativar] = useState(null);
  const [erroDesativar, setErroDesativar] = useState(null);
  const [desativando, setDesativando] = useState(false);

  // --- Excluir conta ---
  const [mostrarExcluir, setMostrarExcluir] = useState(false);
  const [senhaExcluir, setSenhaExcluir] = useState('');
  const [confirmoExclusao, setConfirmoExclusao] = useState(false);
  const [erroExcluir, setErroExcluir] = useState(null);
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => {
    async function buscar() {
      setCarregando(true);
      setErro(null);
      try {
        const dados = await getConfiguracoes();
        setConfig(dados);
      } catch (_) {
        setErro('Não foi possível carregar suas configurações.');
      } finally {
        setCarregando(false);
      }
    }
    buscar();
  }, []);

  // Handler genérico: atualiza otimisticamente e reverte se o PATCH falhar.
  // Funciona igual pros toggles "positivos" (exibir_badges) e pros
  // "negativos" (ocultar_*) — quem inverte a leitura visual é o componente
  // que chama, não esta função.
  async function alternar(campo) {
    const valorAnterior = config[campo];
    setConfig((c) => ({ ...c, [campo]: !valorAnterior }));
    try {
      await atualizarConfiguracoes({ [campo]: !valorAnterior });
    } catch (_) {
      setConfig((c) => ({ ...c, [campo]: valorAnterior }));
    }
  }

  async function handleAlterarSenha(e) {
    e.preventDefault();
    setSenhaErro(null);
    setSenhaSucesso(false);

    if (novaSenha.length < 8) {
      setSenhaErro('A nova senha precisa ter ao menos 8 caracteres.');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setSenhaErro('As senhas não coincidem.');
      return;
    }

    setSalvandoSenha(true);
    try {
      await alterarSenha(senhaAtual, novaSenha);
      setSenhaSucesso(true);
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
    } catch (err) {
      const dados = err.response?.data;
      const mensagem =
        dados?.senha_atual?.[0] || dados?.nova_senha?.[0] || dados?.erro || 'Não foi possível alterar a senha.';
      setSenhaErro(mensagem);
    } finally {
      setSalvandoSenha(false);
    }
  }

  async function handleDesativarConta(e) {
    e.preventDefault();
    setErroDesativar(null);

    if (!senhaDesativar) {
      setErroDesativar('Informe sua senha.');
      return;
    }

    setDesativando(true);
    try {
      await desativarConta(senhaDesativar, duracaoDesativar);
      logout();
      navigate('/login');
    } catch (err) {
      const dados = err.response?.data;
      const mensagem = dados?.senha?.[0] || dados?.detail || 'Não foi possível desativar a conta.';
      setErroDesativar(mensagem);
    } finally {
      setDesativando(false);
    }
  }

  async function handleExcluirConta(e) {
    e.preventDefault();
    setErroExcluir(null);

    if (!senhaExcluir) {
      setErroExcluir('Informe sua senha.');
      return;
    }
    if (!confirmoExclusao) {
      setErroExcluir('Confirme que você entende que essa ação é irreversível.');
      return;
    }

    setExcluindo(true);
    try {
      await excluirConta(senhaExcluir);
      logout();
      navigate('/login');
    } catch (err) {
      const dados = err.response?.data;
      const mensagem = dados?.senha?.[0] || dados?.detail || 'Não foi possível excluir a conta.';
      setErroExcluir(mensagem);
    } finally {
      setExcluindo(false);
    }
  }

  if (carregando) return <p className="pagina-config__estado">Carregando configurações...</p>;
  if (erro) return <p className="pagina-config__estado pagina-config__estado--erro">{erro}</p>;
  if (!config) return null;

  return (
    <div className="pagina-config">
      <h1 className="pagina-config__titulo">Configurações</h1>

      {/* ─── Privacidade ─── */}
      <section className="config-secao">
        <h2 className="config-secao__titulo">Privacidade</h2>

        <form onSubmit={handleAlterarSenha} className="config-senha-form">
          <p className="config-linha__label">Alterar senha</p>
          <input
            type="password"
            placeholder="Senha atual"
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
            className="config-input"
            autoComplete="current-password"
            required
          />
          <input
            type="password"
            placeholder="Nova senha"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            className="config-input"
            autoComplete="new-password"
            required
          />
          <input
            type="password"
            placeholder="Confirmar nova senha"
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
            className="config-input"
            autoComplete="new-password"
            required
          />
          {senhaErro && (
            <p className="config-senha-mensagem config-senha-mensagem--erro">
              <IconeAlerta size={14} /> {senhaErro}
            </p>
          )}
          {senhaSucesso && (
            <p className="config-senha-mensagem config-senha-mensagem--sucesso">
              <IconeSucesso size={14} /> Senha alterada com sucesso.
            </p>
          )}
          <button type="submit" disabled={salvandoSenha} className="btn-primario config-senha-botao">
            {salvandoSenha ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>

        <LinhaToggle
          label={
            <>
              Autenticação de dois fatores <span className="config-chip-em-breve">Em breve</span>
            </>
          }
          ajuda="Uma confirmação extra ao entrar na sua conta."
          checked={false}
          disabled
          onChange={() => {}}
        />

        <LinhaToggle
          label="Conta privada"
          ajuda="Quando ativado, só quem você aprova como seguidor vê seus itinerários e o conteúdo completo do seu perfil. Novos seguidores passam a depender da sua aprovação."
          checked={config.conta_privada}
          onChange={() => alternar('conta_privada')}
        />
      </section>

      {/* ─── Idioma ─── */}
      <section className="config-secao">
        <h2 className="config-secao__titulo">Idioma</h2>
        <div className="config-linha config-linha--sem-divisor">
          <div className="config-linha__texto">
            <p className="config-linha__label">
              Idioma do aplicativo <span className="config-chip-em-breve">Em breve</span>
            </p>
            <p className="config-linha__ajuda">Por enquanto, o AllWays está disponível só em português.</p>
          </div>
        </div>
      </section>

      {/* ─── Notificações ─── */}
      <section className="config-secao">
        <h2 className="config-secao__titulo">Notificações</h2>
        <p className="config-secao__descricao">Escolha o que deve te avisar.</p>

        <LinhaToggle
          label="Alguém seguiu você"
          checked={config.notif_seguiu}
          onChange={() => alternar('notif_seguiu')}
        />
        <LinhaToggle
          label="Comentaram no seu post"
          checked={config.notif_comentou}
          onChange={() => alternar('notif_comentou')}
        />
        <LinhaToggle
          label="Responderam seu comentário"
          checked={config.notif_respondeu}
          onChange={() => alternar('notif_respondeu')}
        />
        <LinhaToggle
          label="Novo post de quem você segue"
          checked={config.notif_novo_post}
          onChange={() => alternar('notif_novo_post')}
        />
      </section>

      {/* ─── Exibição ─── */}
      <section className="config-secao">
        <h2 className="config-secao__titulo">Exibição</h2>
        <p className="config-secao__descricao">Controla o que aparece no seu perfil, para quem visita.</p>

        <LinhaToggle
          label="Exibir badges de outros usuários"
          ajuda="Se desativado, você deixa de ver a badge de destaque de outras pessoas no feed, posts e comentários."
          checked={config.exibir_badges}
          onChange={() => alternar('exibir_badges')}
        />
        <LinhaToggle
          label="Exibir seguidores"
          ajuda="Se ocultar, ninguém além de você vê a sua lista de seguidores."
          checked={!config.ocultar_seguidores}
          onChange={() => alternar('ocultar_seguidores')}
        />
        <LinhaToggle
          label="Exibir usuários seguidos"
          ajuda="Se ocultar, ninguém além de você vê quem você segue."
          checked={!config.ocultar_seguindo}
          onChange={() => alternar('ocultar_seguindo')}
        />
        <LinhaToggle
          label="Exibir lugares seguidos"
          ajuda="Se ocultar, ninguém além de você vê os lugares que você segue."
          checked={!config.ocultar_lugares_seguidos}
          onChange={() => alternar('ocultar_lugares_seguidos')}
        />
      </section>

      {/* ─── Zona de risco: desativar / excluir conta ─── */}
      <section className="config-secao config-secao--perigo">
        <h2 className="config-secao__titulo">Desativar ou excluir conta</h2>

        {/* --- Desativar --- */}
        <div className="config-linha">
          <div className="config-linha__texto">
            <p className="config-linha__label">Desativar conta</p>
            <p className="config-linha__ajuda">
              Seu perfil, comentários, mensagens e itinerários ficam invisíveis para
              outras pessoas até você reativar. Fazer login de novo reativa a conta
              automaticamente, mesmo antes do prazo escolhido.
            </p>
          </div>
          {!mostrarDesativar && (
            <button
              type="button"
              className="config-btn-perigo-contorno"
              onClick={() => setMostrarDesativar(true)}
            >
              Desativar
            </button>
          )}
        </div>

        {mostrarDesativar && (
          <form onSubmit={handleDesativarConta} className="config-senha-form config-senha-form--perigo">
            <p className="config-linha__label">Por quanto tempo?</p>
            <div className="config-duracao-opcoes">
              {DURACOES_DESATIVACAO.map((opcao) => (
                <label key={opcao.label} className="config-duracao-opcao">
                  <input
                    type="radio"
                    name="duracao-desativar"
                    checked={duracaoDesativar === opcao.valor}
                    onChange={() => setDuracaoDesativar(opcao.valor)}
                  />
                  {opcao.label}
                </label>
              ))}
            </div>

            <input
              type="password"
              placeholder="Confirme sua senha"
              value={senhaDesativar}
              onChange={(e) => setSenhaDesativar(e.target.value)}
              className="config-input"
              autoComplete="current-password"
              required
            />

            {erroDesativar && (
              <p className="config-senha-mensagem config-senha-mensagem--erro">
                <IconeAlerta size={14} /> {erroDesativar}
              </p>
            )}

            <div className="config-senha-form__acoes">
              <button type="submit" disabled={desativando} className="config-btn-perigo config-senha-botao">
                {desativando ? 'Desativando...' : 'Confirmar desativação'}
              </button>
              <button
                type="button"
                className="config-btn-secundario config-senha-botao"
                onClick={() => {
                  setMostrarDesativar(false);
                  setSenhaDesativar('');
                  setErroDesativar(null);
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* --- Excluir --- */}
        <div className="config-linha config-linha--sem-divisor">
          <div className="config-linha__texto">
            <p className="config-linha__label">Excluir conta</p>
            <p className="config-linha__ajuda">
              Essa ação é irreversível. Seu perfil, comentários, mensagens e
              itinerários são excluídos e deixam de ficar visíveis para outras pessoas.
            </p>
          </div>
          {!mostrarExcluir && (
            <button
              type="button"
              className="config-btn-perigo-contorno"
              onClick={() => setMostrarExcluir(true)}
            >
              Excluir conta
            </button>
          )}
        </div>

        {mostrarExcluir && (
          <form onSubmit={handleExcluirConta} className="config-senha-form config-senha-form--perigo">
            <input
              type="password"
              placeholder="Confirme sua senha"
              value={senhaExcluir}
              onChange={(e) => setSenhaExcluir(e.target.value)}
              className="config-input"
              autoComplete="current-password"
              required
            />

            <label className="config-checkbox-confirmacao">
              <input
                type="checkbox"
                checked={confirmoExclusao}
                onChange={(e) => setConfirmoExclusao(e.target.checked)}
              />
              Tenho certeza de que desejo excluir minha conta. Sei que essa ação é irreversível.
            </label>

            {erroExcluir && (
              <p className="config-senha-mensagem config-senha-mensagem--erro">
                <IconeAlerta size={14} /> {erroExcluir}
              </p>
            )}

            <div className="config-senha-form__acoes">
              <button
                type="submit"
                disabled={excluindo || !confirmoExclusao}
                className="config-btn-perigo config-senha-botao"
              >
                {excluindo ? 'Excluindo...' : 'Excluir minha conta definitivamente'}
              </button>
              <button
                type="button"
                className="config-btn-secundario config-senha-botao"
                onClick={() => {
                  setMostrarExcluir(false);
                  setSenhaExcluir('');
                  setConfirmoExclusao(false);
                  setErroExcluir(null);
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

export default PaginaConfiguracoes;