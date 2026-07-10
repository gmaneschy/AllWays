import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api, { getUsuarioLogado, getMinhasConquistas, selecionarBadgeDestaque, getConfiguracoes, atualizarConfiguracoes } from './api';
import BadgeDestaque from './BadgeDestaque';

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

/** Modal de seleção de badge de destaque. 'conquistas' vem de /gamification/minhas-conquistas/
 * no formato [{ id, badge: { id, nome, icone, nivel, tipo_nome }, contexto, conquistado_em }, ...].
 * Agrupa por família (tipo_nome) só pra organização visual — a seleção em si é sempre
 * de UM badge (BadgeUsuario) só, respeitando a regra de exclusividade. */
function ModalSelecaoBadge({ conquistas, idAtual, selecionando, onSelecionar, onFechar }) {
  const grupos = conquistas.reduce((acc, c) => {
    const chave = c.badge.tipo_nome;
    (acc[chave] = acc[chave] || []).push(c);
    return acc;
  }, {});

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
          width: 380, maxHeight: '75vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <strong>Escolher badge de destaque</strong>
          <button onClick={onFechar} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>

        <button
          onClick={() => onSelecionar(null)}
          disabled={selecionando}
          style={{
            width: '100%', textAlign: 'left', padding: '10px 12px', marginBottom: 10,
            borderRadius: 8, cursor: 'pointer', fontSize: 14,
            border: idAtual == null ? '2px solid #1a73e8' : '1px solid #ddd',
            background: idAtual == null ? '#f0f5ff' : '#999999',
          }}
        >
          Nenhuma badge exibida
        </button>

        {conquistas.length === 0 && (
          <p style={{ color: '#999', fontSize: 14 }}>Você ainda não conquistou nenhuma badge.</p>
        )}

        {Object.entries(grupos).map(([tipoNome, itens]) => (
          <div key={tipoNome} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 'bold', color: '#999', textTransform: 'uppercase', marginBottom: 6 }}>
              {tipoNome}
            </div>
            {itens.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelecionar(c.badge.id)}
                disabled={selecionando}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  textAlign: 'left', padding: '8px 12px', marginBottom: 6,
                  borderRadius: 8, cursor: 'pointer',
                  border: idAtual === c.badge.id ? '2px solid #1a73e8' : '1px solid #eee',
                  background: idAtual === c.badge.id ? '#999999' : '#999999',
                }}
              >
                <img src={c.badge.icone} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 'bold' }}>{c.badge.nome}</div>
                  {c.contexto && <div style={{ fontSize: 12, color: '#888' }}>{c.contexto}</div>}
                </div>
              </button>
            ))}
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

  // Badge de destaque
  const [modalBadgeAberto, setModalBadgeAberto] = useState(false);
  const [conquistas, setConquistas] = useState([]);
  const [selecionandoBadge, setSelecionandoBadge] = useState(false);
  const [badgeDestaqueRealId, setBadgeDestaqueRealId] = useState(usuarioLogado?.badge_destaque?.id ?? null);

  // Configurações (toggle exibir_badges) — só relevante no próprio perfil
  const [configuracoes, setConfiguracoes] = useState(null);
  const [salvandoConfig, setSalvandoConfig] = useState(false);

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

  const ehProprioPerfil = usuarioLogado?.username === username;

  useEffect(() => {
    if (!ehProprioPerfil) return;
    getConfiguracoes().then(setConfiguracoes).catch(() => {});
  }, [ehProprioPerfil]);

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

  async function abrirModalBadge() {
    setModalBadgeAberto(true);
    try {
      const dados = await getMinhasConquistas();
      setConquistas(dados);
    } catch (_) {
      setConquistas([]);
    }
  }

  async function handleSelecionarBadge(badgeId) {
    if (selecionandoBadge) return;
    setSelecionandoBadge(true);
    try {
      const meAtualizado = await selecionarBadgeDestaque(badgeId);
      setBadgeDestaqueRealId(meAtualizado.badge_destaque?.id ?? null);
      // Reflete a mudança na tela sem precisar refazer o GET completo do perfil
      setPerfil((prev) => ({ ...prev, badge_destaque: meAtualizado.exibir_badges ? meAtualizado.badge_destaque : null }));
      setModalBadgeAberto(false);
    } catch (_) {
      setErro('Não foi possível atualizar a badge de destaque.');
    } finally {
      setSelecionandoBadge(false);
    }
  }

  async function alternarExibirBadges() {
    if (salvandoConfig || !configuracoes) return;
    setSalvandoConfig(true);
    try {
      const atualizado = await atualizarConfiguracoes({ exibir_badges: !configuracoes.exibir_badges });
      setConfiguracoes(atualizado);
      // Se desativou, a badge some da visão pública imediatamente
      setPerfil((prev) => ({ ...prev, badge_destaque: atualizado.exibir_badges ? prev.badge_destaque : null }));
      // Se reativou, refaz o GET do perfil pra trazer de volta a badge_destaque real
      if (atualizado.exibir_badges) buscarPerfil();
    } catch (_) {} finally {
      setSalvandoConfig(false);
    }
  }

  if (carregando) return <p style={{ textAlign: 'center', marginTop: 40 }}>Carregando...</p>;
  if (erro && !perfil) return <p style={{ textAlign: 'center', marginTop: 40, color: 'red' }}>{erro}</p>;
  if (!perfil) return null;

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ margin: 0 }}>{perfil.username}</h1>
            <BadgeDestaque badge={perfil.badge_destaque} size={22} />
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

      {/* Painel de gerenciamento — só o dono do perfil vê */}
      {ehProprioPerfil && (
        <div style={{ border: '1px solid #eee', borderRadius: 10, padding: 14, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: configuracoes ? 10 : 0 }}>
            <span style={{ fontSize: 14, fontWeight: 'bold' }}>Suas badges</span>
            <button
              onClick={abrirModalBadge}
              style={{ fontSize: 13, padding: '5px 12px', borderRadius: 6, border: '1px solid #ddd', background: '#999999', cursor: 'pointer' }}
            >
              Escolher destaque
            </button>
          </div>

          {configuracoes && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#555', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={configuracoes.exibir_badges}
                onChange={alternarExibirBadges}
                disabled={salvandoConfig}
              />
              Exibir minhas badges publicamente (feed, posts e comentários)
            </label>
          )}
        </div>
      )}

      {perfil.badges?.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {perfil.badges.map((b, i) => (
            <div key={i} title={`${b.nome}${b.contexto ? ' — ' + b.contexto : ''}`} style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, background: '#f0f0f0',
              padding: '4px 10px 4px 4px', borderRadius: 12,
            }}>
              <img src={b.icone} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />
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

      {modalBadgeAberto && (
        <ModalSelecaoBadge
          conquistas={conquistas}
          idAtual={badgeDestaqueRealId}
          selecionando={selecionandoBadge}
          onSelecionar={handleSelecionarBadge}
          onFechar={() => setModalBadgeAberto(false)}
        />
      )}
    </div>
  );
}

export default PaginaPerfil;