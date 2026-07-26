import { useState, useEffect } from 'react';
import api, { compartilharItinerario } from './api';
import { IconeFechar, IconeSucesso } from './icons';
import './ModalCompartilharItinerario.css';

function Avatar({ usuario, tamanho = 32 }) {
  if (usuario?.foto_perfil) {
    return (
      <img
        src={usuario.foto_perfil}
        alt={usuario.username}
        className="modal-compartilhar__avatar"
        style={{ width: tamanho, height: tamanho }}
      />
    );
  }
  return (
    <div
      className="modal-compartilhar__avatar-vazio"
      style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.4 }}
    >
      {usuario?.username?.[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

function ModalCompartilharItinerario({ itinerarioId, itinerarioTitulo, onFechar }) {
  const [query, setQuery] = useState('');
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [enviandoPara, setEnviandoPara] = useState(null); // username em envio
  const [enviadoPara, setEnviadoPara] = useState(new Set());
  const [erro, setErro] = useState(null);

  useEffect(() => {
    async function buscar() {
      setCarregando(true);
      try {
        const params = query ? `?q=${encodeURIComponent(query)}` : '';
        const res = await api.get(`/social/mensagens/destinatarios/${params}`);
        setUsuarios(res.data);
      } catch (_) {} finally { setCarregando(false); }
    }
    const t = setTimeout(buscar, query ? 300 : 0);
    return () => clearTimeout(t);
  }, [query]);

  async function handleEnviar(usuario) {
    setEnviandoPara(usuario.username);
    setErro(null);
    try {
      await compartilharItinerario(usuario.username, itinerarioId);
      setEnviadoPara((prev) => new Set(prev).add(usuario.username));
    } catch (_) {
      setErro('Não foi possível enviar. Tente novamente.');
    } finally {
      setEnviandoPara(null);
    }
  }

  return (
    <div onClick={onFechar} className="modal-compartilhar-overlay">
      <div onClick={(e) => e.stopPropagation()} className="modal-compartilhar">
        <div className="modal-compartilhar__header">
          <strong className="modal-compartilhar__titulo">Compartilhar itinerário</strong>
          <button onClick={onFechar} className="modal-compartilhar__fechar">
            <IconeFechar size={20} />
          </button>
        </div>

        {itinerarioTitulo && (
          <p className="modal-compartilhar__subtitulo">{itinerarioTitulo}</p>
        )}

        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar usuário..."
          className="modal-compartilhar__busca"
        />

        {erro && <p className="modal-compartilhar__erro">{erro}</p>}

        <div className="modal-compartilhar__lista">
          {carregando && <p className="modal-compartilhar__estado-vazio">Carregando...</p>}
          {!carregando && usuarios.length === 0 && (
            <p className="modal-compartilhar__estado-vazio">Nenhum usuário encontrado.</p>
          )}
          {usuarios.map((u) => {
            const jaEnviado = enviadoPara.has(u.username);
            return (
              <div key={u.id} className="modal-compartilhar__usuario">
                <Avatar usuario={u} tamanho={32} />
                <div className="modal-compartilhar__nome-info">
                  <div className="modal-compartilhar__nome">{u.nome_exibicao || u.username}</div>
                  <div className="modal-compartilhar__username">@{u.username}</div>
                </div>
                <button
                  onClick={() => handleEnviar(u)}
                  disabled={enviandoPara === u.username || jaEnviado}
                  className={`modal-compartilhar__btn-enviar${jaEnviado ? ' modal-compartilhar__btn-enviar--enviado' : ''}`}
                >
                  {jaEnviado
                    ? <><IconeSucesso size={14} /> Enviado</>
                    : enviandoPara === u.username ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ModalCompartilharItinerario;