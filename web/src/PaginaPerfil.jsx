import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api, { getUsuarioLogado } from './api';

function ModalListaUsuarios({ titulo, usuarios, onFechar }) {
  return (
    <div
      onClick={onFechar}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 12, padding: 20,
          width: 320, maxHeight: '70vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <strong>{titulo}</strong>
          <button onClick={onFechar} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>

        {usuarios.length === 0 && <p style={{ color: '#999' }}>Ninguém por aqui ainda.</p>}

        {usuarios.map((u) => (
          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
            {u.foto_perfil
              ? <img src={u.foto_perfil} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
              : <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#ddd',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                  {u.username[0].toUpperCase()}
                </div>
            }
            <span>{u.username}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaginaPerfil() {
  const { username } = useParams();
  const usuarioLogado = getUsuarioLogado();
  const [perfil, setPerfil] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [aba, setAba] = useState('publicados');
  const [enviandoFollow, setEnviandoFollow] = useState(false);
  const [modalAberto, setModalAberto] = useState(null); // 'seguidores' | 'seguindo' | null
  const [listaModal, setListaModal] = useState([]);

  async function buscarPerfil() {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await api.get(`/users/${username}/`);
      setPerfil(resposta.data);
    } catch (err) {
      setErro('Usuário não encontrado.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (username) buscarPerfil();
  }, [username]);

  async function alternarSeguir() {
    if (enviandoFollow) return;
    setEnviandoFollow(true);
    try {
      const resposta = await api.post('/social/follow/', { tipo: 'usuario', alvo_id: perfil.id });
      setPerfil({
        ...perfil,
        voce_segue: resposta.data.seguindo,
        total_seguidores: perfil.total_seguidores + (resposta.data.seguindo ? 1 : -1),
      });
    } catch (err) {
      setErro('Não foi possível atualizar o follow agora.');
    } finally {
      setEnviandoFollow(false);
    }
  }

  async function abrirModal(tipo) {
    setModalAberto(tipo);
    try {
      const resposta = await api.get(`/social/usuarios/${username}/${tipo}/`);
      setListaModal(resposta.data);
    } catch (err) {
      setListaModal([]);
    }
  }

  if (carregando) return <p style={{ textAlign: 'center', marginTop: 40 }}>Carregando...</p>;
  if (erro && !perfil) return <p style={{ textAlign: 'center', marginTop: 40, color: 'red' }}>{erro}</p>;
  if (!perfil) return null;

  const ehProprioPerfil = usuarioLogado?.username === perfil.username;

  const abas = [
    { key: 'publicados', label: 'Publicados' },
    ...(perfil.salvos ? [{ key: 'salvos', label: 'Salvos' }] : []),
    ...(perfil.rascunhos ? [{ key: 'rascunhos', label: 'Rascunhos' }] : []),
  ];

  const itinerariosAba = {
    publicados: perfil.itinerarios_publicados,
    salvos: perfil.salvos || [],
    rascunhos: perfil.rascunhos || [],
  }[aba];

  return (
    <div style={{ maxWidth: 650, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginBottom: 24 }}>
        {perfil.foto_perfil
          ? <img src={perfil.foto_perfil} alt="Foto de perfil"
              style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} />
          : <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#ddd',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
              {perfil.username[0].toUpperCase()}
            </div>
        }

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ margin: 0 }}>{perfil.username}</h1>
            {!ehProprioPerfil && perfil.voce_segue !== null && (
              <button
                onClick={alternarSeguir}
                disabled={enviandoFollow}
                style={{
                  padding: '6px 16px', borderRadius: 6, cursor: 'pointer',
                  border: perfil.voce_segue ? '1px solid #ccc' : 'none',
                  background: perfil.voce_segue ? '#f0f0f0' : '#1a73e8',
                  color: perfil.voce_segue ? '#333' : '#fff',
                  fontWeight: 'bold',
                }}
              >
                {perfil.voce_segue ? 'Seguindo' : 'Seguir'}
              </button>
            )}
          </div>
          {perfil.bio && <p style={{ color: '#666', margin: '4px 0' }}>{perfil.bio}</p>}
          <p style={{ margin: '4px 0', fontSize: 14 }}>
            <button onClick={() => abrirModal('seguidores')}
              style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}>
              <strong>{perfil.total_seguidores}</strong> seguidores
            </button>
            {' · '}
            <button onClick={() => abrirModal('seguindo')}
              style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}>
              <strong>{perfil.total_seguindo_usuarios}</strong> usuários seguidos
            </button>
            {perfil.total_seguindo_lugares > 0 && (
              <>
                {' · '}
                <strong>{perfil.total_seguindo_lugares}</strong> lugar{perfil.total_seguindo_lugares !== 1 ? 'es' : ''} seguido{perfil.total_seguindo_lugares !== 1 ? 's' : ''}
              </>
            )}
          </p>
        </div>
      </div>

      {erro && <p style={{ color: 'red', fontSize: 13 }}>{erro}</p>}

      {perfil.badges?.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {perfil.badges.map((b, i) => (
            <div key={i} title={b.nome} style={{ fontSize: 12, background: '#f0f0f0',
                padding: '4px 8px', borderRadius: 12 }}>
              {b.nome}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #eee', marginBottom: 20 }}>
        {abas.map((a) => (
          <button key={a.key} onClick={() => setAba(a.key)} style={{
            padding: '8px 20px', background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: aba === a.key ? '2px solid #1a73e8' : '2px solid transparent',
            fontWeight: aba === a.key ? 'bold' : 'normal',
            color: aba === a.key ? '#1a73e8' : '#333',
          }}>
            {a.label}
          </button>
        ))}
      </div>

      {itinerariosAba.length === 0 && (
        <p style={{ color: '#999' }}>Nenhum itinerário aqui ainda.</p>
      )}

      {itinerariosAba.map((it) => (
        <div key={it.id} style={{ border: '1px solid #ddd', borderRadius: 8,
            padding: 16, marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{it.titulo}</h3>
          <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>
            {it.tipo === 'day_trip' ? 'Day Trip' : 'Multi-Day Trip'}
            {it.data_inicio && ` · ${it.data_inicio}`}
          </p>
        </div>
      ))}

      {modalAberto && (
        <ModalListaUsuarios
          titulo={modalAberto === 'seguidores' ? 'Seguidores' : 'Seguindo'}
          usuarios={listaModal}
          onFechar={() => setModalAberto(null)}
        />
      )}
    </div>
  );
}

export default PaginaPerfil;