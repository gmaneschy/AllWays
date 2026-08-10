import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { estaLogado, getUsuarioLogado, logout, getNotificacoesNaoLidas, getMensagensNaoLidas } from './api';
import PainelNotificacoes from './PainelNotificacoes';
import { AvisoSair } from './Avisos';
import { PaginaSemNavbar } from './layoutRotas';
import {
  IconeInicio,
  IconeExplorarNav,
  IconeCriarItinerario,
  IconeMensagem,
  IconeNotificacao,
  IconeConfiguracoes,
  IconeUsuario,
  IconeSair,
  IconeEntrar,
} from './icons';
import './Navbar.css';

const LINKS_PUBLICOS = [
  { to: '/', label: 'Feed', Icone: IconeInicio },
  { to: '/explorar', label: 'Explorar', Icone: IconeExplorarNav },
];

function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const logado = estaLogado();
  const usuario = getUsuarioLogado();
  const [painelAberto, setPainelAberto] = useState(false);
  const [naoLidas, setNaoLidas] = useState(0);
  const [mensagensNaoLidas, setMensagensNaoLidas] = useState(0);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);
  const sinoRef = useRef(null);

  useEffect(() => {
    if (!logado) return;
    async function buscarContador() {
      try {
        const { total } = await getNotificacoesNaoLidas();
        setNaoLidas(total);
      } catch (_) {}
    }
    buscarContador();
    const intervalo = setInterval(buscarContador, 20000);
    return () => clearInterval(intervalo);
  }, [logado]);

  useEffect(() => {
    if (!logado) return;
    async function buscarContadorMensagens() {
      try {
        const { total } = await getMensagensNaoLidas();
        setMensagensNaoLidas(total);
      } catch (_) {}
    }
    buscarContadorMensagens();
    const intervalo = setInterval(buscarContadorMensagens, 20000);
    return () => clearInterval(intervalo);
  }, [logado]);

  useEffect(() => {
    function handleClickFora(e) {
      if (sinoRef.current && !sinoRef.current.contains(e.target)) {
        setPainelAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  function handleLogout() {
    setConfirmandoSaida(true);
  }

  function handleConfirmarLogout() {
    logout();
    navigate('/login');
  }

  function classeLink(path) {
    return `navbar__link${location.pathname === path ? ' navbar__link--ativo' : ''}`;
  }

  // Páginas full-page (login, ativação de conta) não mostram a navbar, nem
  // a versão reduzida com só o link "Entrar" — lista centralizada em
  // layoutRotas.js (usada também pelo App.jsx pra zerar o layout). Isso
  // cobre tanto acessar essas rotas direto quanto o logout, que
  // redireciona pra /login e, sem esse guard, deixava a navbar reduzida
  // visível na tela.
  if (PaginaSemNavbar(location.pathname)) return null;

  return (
    <nav className={`navbar${painelAberto ? ' navbar--expandido' : ''}`}>
      {/* ─── Topo: navegação principal ─── */}
      <div className="navbar__secao">
        {LINKS_PUBLICOS.map(({ to, label, Icone }) => (
          <Link key={to} to={to} className={classeLink(to)}>
            <Icone size={22} className="navbar__icone" />
            <span className="navbar__label">{label}</span>
          </Link>
        ))}

        {logado && (
          <Link to="/criar" className={classeLink('/criar')}>
            <IconeCriarItinerario size={22} className="navbar__icone" />
            <span className="navbar__label">Criar Itinerário</span>
          </Link>
        )}

        {logado && (
          <Link to="/mensagens" className={classeLink('/mensagens')}>
            <span className="navbar__icone-wrapper">
              <IconeMensagem size={22} className="navbar__icone" />
              {mensagensNaoLidas > 0 && (
                <span className="navbar__badge">
                  {mensagensNaoLidas > 9 ? '9+' : mensagensNaoLidas}
                </span>
              )}
            </span>
            <span className="navbar__label">Mensagens</span>
          </Link>
        )}

        {logado && (
          <div ref={sinoRef} className="navbar__item-wrapper">
            <button
              onClick={() => setPainelAberto((prev) => !prev)}
              className={`navbar__link navbar__botao${painelAberto ? ' navbar__link--ativo' : ''}`}
            >
              <span className="navbar__icone-wrapper">
                <IconeNotificacao size={22} className="navbar__icone" />
                {naoLidas > 0 && (
                  <span className="navbar__badge">
                    {naoLidas > 9 ? '9+' : naoLidas}
                  </span>
                )}
              </span>
              <span className="navbar__label">Notificações</span>
            </button>

            {painelAberto && (
              <PainelNotificacoes
                onFechar={() => setPainelAberto(false)}
                onMudouNaoLidas={(novoTotal) => setNaoLidas(novoTotal)}
              />
            )}
          </div>
        )}
      </div>

      {/* ─── Rodapé: conta do usuário ─── */}
      <div className="navbar__secao">
        {logado ? (
          <>
            <Link to={`/perfil/${usuario?.username}`} className={classeLink(`/perfil/${usuario?.username}`)}>
              <IconeUsuario size={22} className="navbar__icone" />
              <span className="navbar__label">{usuario?.username}</span>
            </Link>
            <Link to="/configuracoes" className={classeLink('/configuracoes')}>
              <IconeConfiguracoes size={22} className="navbar__icone" />
              <span className="navbar__label">Configurações</span>
            </Link>
            <button onClick={handleLogout} className="navbar__link navbar__botao">
              <IconeSair size={22} className="navbar__icone" />
              <span className="navbar__label">Sair</span>
            </button>
          </>
        ) : (
          <Link to="/login" className={classeLink('/login')}>
            <IconeEntrar size={22} className="navbar__icone" />
            <span className="navbar__label">Entrar</span>
          </Link>
        )}
      </div>

      <AvisoSair
        aberto={confirmandoSaida}
        onConfirmar={handleConfirmarLogout}
        onCancelar={() => setConfirmandoSaida(false)}
      />
    </nav>
  );
}

export default Navbar;