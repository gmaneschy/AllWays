import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { getUsuarioLogado, getMinhasConquistas, selecionarBadgeDestaque, getConfiguracoes, atualizarConfiguracoes, editarPerfil, getMe } from './api';
import BadgeDestaque from './BadgeDestaque';
import ModalCompartilharItinerario from './ModalCompartilharItinerario';
import { IconeFechar, IconeCompartilhar, IconeSeguir, IconeEditar } from './icons';
import './PaginaPerfil.css';

function ModalListaUsuarios({ titulo, tipo, itens, onFechar }) {
  const ehLugares = tipo === 'lugares';

  return (
    <div onClick={onFechar} className="modal-overlay">
      <div onClick={(e) => e.stopPropagation()} className="modal-box modal-box--pequena">
        <div className="modal-box__header">
          <strong>{titulo}</strong>
          <button onClick={onFechar} className="modal-box__fechar">
            <IconeFechar size={18} />
          </button>
        </div>

        {itens.length === 0 && (
          <p className="modal-usuarios__vazio">
            {ehLugares ? 'Nenhum lugar seguido ainda.' : 'Ninguém por aqui ainda.'}
          </p>
        )}

        {ehLugares
          ? itens.map((p) => (
              <Link key={p.id} to={`/place/${p.id}`} onClick={onFechar} className="usuario-item">
                <div className="usuario-item__avatar-vazio">{p.nome[0].toUpperCase()}</div>
                <span>{p.nome}</span>
              </Link>
            ))
          : itens.map((u) => (
              <Link key={u.id} to={`/perfil/${u.username}`} onClick={onFechar} className="usuario-item">
                {u.foto_perfil
                  ? <img src={u.foto_perfil} alt="" className="usuario-item__avatar" />
                  : <div className="usuario-item__avatar-vazio">{u.username[0].toUpperCase()}</div>
                }
                <span>{u.username}</span>
              </Link>
            ))
        }
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
    <div onClick={onFechar} className="modal-overlay">
      <div onClick={(e) => e.stopPropagation()} className="modal-box modal-box--grande">
        <div className="modal-box__header">
          <strong>Escolher badge de destaque</strong>
          <button onClick={onFechar} className="modal-box__fechar">
            <IconeFechar size={18} />
          </button>
        </div>

        <button
          onClick={() => onSelecionar(null)}
          disabled={selecionando}
          className={`modal-badge__opcao${idAtual == null ? ' modal-badge__opcao--selecionada' : ''}`}
        >
          Nenhuma badge exibida
        </button>

        {conquistas.length === 0 && (
          <p className="modal-badge__vazio">Você ainda não conquistou nenhuma badge.</p>
        )}

        {Object.entries(grupos).map(([tipoNome, itens]) => (
          <div key={tipoNome} className="modal-badge__grupo">
            <div className="modal-badge__grupo-titulo">{tipoNome}</div>
            {itens.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelecionar(c.badge.id)}
                disabled={selecionando}
                className={`modal-badge__item${idAtual === c.badge.id ? ' modal-badge__item--selecionada' : ''}`}
              >
                <img src={c.badge.icone} alt="" className="modal-badge__item-icone" />
                <div>
                  <div className="modal-badge__item-nome">{c.badge.nome}</div>
                  {c.contexto && <div className="modal-badge__item-contexto">{c.contexto}</div>}
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Modal de edição de nome_exibicao + bio. 'me' vem de GET /users/me/ (inclui
 * dias_para_trocar_nome_exibicao, calculado no backend). Bio nunca tem cooldown;
 * nome_exibicao só é bloqueado se o valor digitado for DIFERENTE do atual. */
function ModalEditarPerfil({ me, salvando, erro, onSalvar, onFechar }) {
  const [nomeExibicao, setNomeExibicao] = useState(me.nome_exibicao || '');
  const [bio, setBio] = useState(me.bio || '');
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(me.foto_perfil || null);

  const cooldownAtivo = me.dias_para_trocar_nome_exibicao > 0;
  const nomeMudou = nomeExibicao.trim() !== me.nome_exibicao;
  const bloqueado = cooldownAtivo && nomeMudou;

  function handleFotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
    e.target.value = '';
  }

  function handleSalvar() {
    if (bloqueado || salvando) return;
    if (fotoFile) {
      const form = new FormData();
      form.append('nome_exibicao', nomeExibicao.trim());
      form.append('bio', bio);
      form.append('foto_perfil', fotoFile);
      onSalvar(form);
    } else {
      onSalvar({ nome_exibicao: nomeExibicao.trim(), bio });
    }
  }

  return (
    <div onClick={onFechar} className="modal-overlay">
      <div onClick={(e) => e.stopPropagation()} className="modal-box modal-box--media">
        <div className="modal-box__header">
          <strong>Editar perfil</strong>
          <button onClick={onFechar} className="modal-box__fechar">
            <IconeFechar size={18} />
          </button>
        </div>

        <div className="modal-editar__avatar-linha">
          <label className="modal-editar__avatar-label">
            {fotoPreview
              ? <img src={fotoPreview} alt="Foto de perfil" className="modal-editar__avatar" />
              : <div className="modal-editar__avatar-vazio">{(nomeExibicao || me.username)[0]?.toUpperCase()}</div>
            }
            <div className="modal-editar__avatar-badge">
              <IconeEditar size={13} />
            </div>
            <input type="file" accept="image/*" onChange={handleFotoChange} className="modal-editar__input-arquivo" />
          </label>
        </div>

        <label className="modal-editar__label">Nome de exibição</label>
        <input
          value={nomeExibicao}
          onChange={(e) => setNomeExibicao(e.target.value)}
          maxLength={50}
          className="modal-editar__input"
        />
        {cooldownAtivo && (
          <p className={`modal-editar__cooldown-aviso${nomeMudou ? ' modal-editar__cooldown-aviso--bloqueado' : ''}`}>
            {nomeMudou
              ? `Você poderá trocar o nome de exibição novamente em ${me.dias_para_trocar_nome_exibicao} dia${me.dias_para_trocar_nome_exibicao !== 1 ? 's' : ''}.`
              : `Próxima troca disponível em ${me.dias_para_trocar_nome_exibicao} dia${me.dias_para_trocar_nome_exibicao !== 1 ? 's' : ''}.`}
          </p>
        )}
        {!cooldownAtivo && <div className="modal-editar__espaco" />}

        <label className="modal-editar__label">Bio</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={200}
          rows={3}
          className="modal-editar__textarea"
        />
        <p className="modal-editar__contador-bio">{bio.length}/200</p>

        {erro && <p className="modal-editar__erro">{erro}</p>}

        <button
          onClick={handleSalvar}
          disabled={salvando || bloqueado || !nomeExibicao.trim()}
          className="modal-editar__salvar"
        >
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
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
  const [compartilhando, setCompartilhando] = useState(null); // itinerário sendo compartilhado
  const [listaModal, setListaModal] = useState([]);

  // Badge de destaque
  const [modalBadgeAberto, setModalBadgeAberto] = useState(false);
  const [conquistas, setConquistas] = useState([]);
  const [selecionandoBadge, setSelecionandoBadge] = useState(false);
  const [badgeDestaqueRealId, setBadgeDestaqueRealId] = useState(usuarioLogado?.badge_destaque?.id ?? null);

  // Configurações (toggle exibir_badges) — só relevante no próprio perfil
  const [configuracoes, setConfiguracoes] = useState(null);
  const [salvandoConfig, setSalvandoConfig] = useState(false);

  // Edição de perfil (nome de exibição + bio)
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [meEdicao, setMeEdicao] = useState(null);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [erroEdicao, setErroEdicao] = useState(null);

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
      const { seguindo, solicitado } = resposta.data;

      setPerfil((prev) => {
        // A contagem de seguidores só muda de verdade quando um Follow é
        // criado ou desfeito. Pedir pra seguir uma conta privada
        // ('solicitado: true') ou cancelar esse pedido (volta a
        // seguindo:false sem nunca ter sido true) não mexe no total real —
        // é exatamente o caso que antes ficava subtraindo a cada clique.
        const jaSeguia = prev.voce_segue === true;
        let novoTotal = prev.total_seguidores;
        if (typeof novoTotal === 'number') {
          if (!jaSeguia && seguindo) novoTotal += 1;
          else if (jaSeguia && !seguindo) novoTotal -= 1;
        }

        return {
          ...prev,
          voce_segue: seguindo,
          solicitado: !!solicitado,
          total_seguidores: novoTotal,
        };
      });
    } catch (err) {
      setErro('Não foi possível atualizar o follow agora.');
    } finally {
      setEnviandoFollow(false);
    }
  }

  async function abrirModal(tipo) {
    setModalAberto(tipo);
    setListaModal([]); // limpa antes de buscar, senão o formato antigo (usuário/lugar) fica incompatível com o novo 'tipo' até a resposta chegar
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

  async function abrirModalEditar() {
    setErroEdicao(null);
    setModalEditarAberto(true);
    try {
      // Busca fresca: dias_para_trocar_nome_exibicao precisa vir calculado
      // na hora, não do localStorage (que pode estar desatualizado).
      const me = await getMe();
      setMeEdicao(me);
    } catch (_) {
      setErroEdicao('Não foi possível carregar seus dados agora.');
    }
  }

  async function handleSalvarPerfil(payload) {
    setSalvandoPerfil(true);
    setErroEdicao(null);
    try {
      const atualizado = await editarPerfil(payload);
      setPerfil((prev) => ({
        ...prev,
        nome_exibicao: atualizado.nome_exibicao,
        bio: atualizado.bio,
        foto_perfil: atualizado.foto_perfil,
      }));
      setModalEditarAberto(false);
    } catch (err) {
      const dados = err.response?.data;
      const mensagem = dados?.nome_exibicao?.[0] || dados?.bio?.[0] || dados?.foto_perfil?.[0]
        || 'Não foi possível salvar as alterações.';
      setErroEdicao(mensagem);
    } finally {
      setSalvandoPerfil(false);
    }
  }

  if (carregando) return <p className="pagina-perfil__carregando">Carregando...</p>;
  if (erro && !perfil) return <p className="pagina-perfil__erro">{erro}</p>;
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
    <div className="pagina-perfil">
      <div className="perfil-header">
        {perfil.foto_perfil
          ? <img src={perfil.foto_perfil} alt="Foto de perfil" className="perfil-header__avatar" />
          : <div className="perfil-header__avatar-vazio">{perfil.username[0].toUpperCase()}</div>
        }

        <div className="perfil-header__info">
          {perfil.nome_exibicao && (
            <div className="perfil-header__nome-exibicao">{perfil.nome_exibicao}</div>
          )}
          <div className="perfil-header__linha-username">
            <h1 className="perfil-header__username">@{perfil.username}</h1>
            <BadgeDestaque badge={perfil.badge_destaque} size={22} />
            {!ehProprioPerfil && perfil.voce_segue !== null && (
              <button
                onClick={alternarSeguir}
                disabled={enviandoFollow}
                className={[
                  'btn-seguir',
                  perfil.voce_segue && 'btn-seguir--seguindo',
                  perfil.solicitado && 'btn-seguir--solicitado',
                ].filter(Boolean).join(' ')}
              >
                {!perfil.voce_segue && !perfil.solicitado && <IconeSeguir size={15} />}
                {perfil.voce_segue ? 'Seguindo' : perfil.solicitado ? 'Solicitação enviada' : 'Seguir'}
              </button>
            )}
          </div>
          {perfil.bio && <p className="perfil-header__bio">{perfil.bio}</p>}
          <p className="perfil-header__stats">
            {perfil.total_seguidores !== null ? (
              <button onClick={() => abrirModal('seguidores')} className="perfil-header__stats-link">
                <strong>{perfil.total_seguidores}</strong> seguidores
              </button>
            ) : (
              <span className="perfil-header__stats-link" style={{ opacity: 0.6, cursor: 'default' }}>
                <strong>--</strong> seguidores
              </span>
            )}
            {' · '}
            {perfil.total_seguindo_usuarios !== null ? (
              <button onClick={() => abrirModal('seguindo')} className="perfil-header__stats-link">
                <strong>{perfil.total_seguindo_usuarios}</strong> usuários seguidos
              </button>
            ) : (
              <span className="perfil-header__stats-link" style={{ opacity: 0.6, cursor: 'default' }}>
                <strong>--</strong> usuários seguidos
              </span>
            )}
            {(perfil.total_seguindo_lugares > 0 || perfil.total_seguindo_lugares === null) && (
              <>
                {' · '}
                {perfil.total_seguindo_lugares !== null ? (
                  <button onClick={() => abrirModal('lugares')} className="perfil-header__stats-link">
                    <strong>{perfil.total_seguindo_lugares}</strong> lugar{perfil.total_seguindo_lugares !== 1 ? 'es' : ''} seguido{perfil.total_seguindo_lugares !== 1 ? 's' : ''}
                  </button>
                ) : (
                  <span className="perfil-header__stats-link" style={{ opacity: 0.6, cursor: 'default' }}>
                    <strong>--</strong> lugares seguidos
                  </span>
                )}
              </>
            )}
          </p>
        </div>
      </div>

      {erro && <p className="perfil-erro">{erro}</p>}

      {/* Painel de gerenciamento — só o dono do perfil vê */}
      {ehProprioPerfil && (
        <div className="painel-gerenciamento">
          <div className="painel-gerenciamento__linha">
            <span className="painel-gerenciamento__titulo">Seu perfil</span>
            <button onClick={abrirModalEditar} className="btn-secundario btn-secundario--compacto">
              Editar perfil
            </button>
          </div>

          <div className={`painel-gerenciamento__linha${!configuracoes ? ' painel-gerenciamento__linha--sem-margem' : ''}`}>
            <span className="painel-gerenciamento__titulo">Suas badges</span>
            <button onClick={abrirModalBadge} className="btn-secundario btn-secundario--compacto">
              Escolher destaque
            </button>
          </div>

          {configuracoes && (
            <label className="painel-gerenciamento__exibir-badges">
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
        <div className="perfil-badges-lista">
          {perfil.badges.map((b, i) => (
            <div key={i} title={`${b.nome}${b.contexto ? ' — ' + b.contexto : ''}`} className="perfil-badge-chip">
              <img src={b.icone} alt="" className="perfil-badge-chip__icone" />
              {b.nome}
            </div>
          ))}
        </div>
      )}

      <div className="perfil-abas">
        {abas.map((a) => (
          <button
            key={a.key}
            onClick={() => setAba(a.key)}
            className={`perfil-abas__botao${aba === a.key ? ' perfil-abas__botao--ativa' : ''}`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {itinerariosAba.length === 0 && (
        <p className="perfil-lista-vazia">Nenhum itinerário aqui ainda.</p>
      )}

      {itinerariosAba.map((it) => (
        <div key={it.id} className="itinerario-card">
          <div className="itinerario-card__cabecalho">
            <Link to={`/itinerario/${it.id}`} className="itinerario-card__link">
              <h3 className="itinerario-card__titulo">{it.titulo}</h3>
            </Link>
            <button
              onClick={() => setCompartilhando(it)}
              title="Compartilhar"
              className="itinerario-card__compartilhar"
            >
              <IconeCompartilhar size={16} />
            </button>
          </div>
          <p className="itinerario-card__meta">
            {it.tipo === 'day_trip' ? 'Day Trip' : 'Multi-Day Trip'}
            {it.data_inicio && ` · ${it.data_inicio}`}
          </p>
        </div>
      ))}

      {modalAberto && (
        <ModalListaUsuarios
          titulo={
            modalAberto === 'seguidores' ? 'Seguidores'
              : modalAberto === 'seguindo' ? 'Seguindo'
              : 'Lugares seguidos'
          }
          tipo={modalAberto}
          itens={listaModal}
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

      {modalEditarAberto && meEdicao && (
        <ModalEditarPerfil
          me={meEdicao}
          salvando={salvandoPerfil}
          erro={erroEdicao}
          onSalvar={handleSalvarPerfil}
          onFechar={() => setModalEditarAberto(false)}
        />
      )}

      {compartilhando && (
        <ModalCompartilharItinerario
          itinerarioId={compartilhando.id}
          itinerarioTitulo={compartilhando.titulo}
          onFechar={() => setCompartilhando(null)}
        />
      )}
    </div>
  );
}

export default PaginaPerfil;