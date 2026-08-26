import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getUsuarioLogado, getMinhasConquistas, selecionarBadgeDestaque, getConfiguracoes, atualizarConfiguracoes, editarPerfil, getMe } from './api';
import BadgeDestaque from './BadgeDestaque';
import CardItinerarioResumo from './CardItinerarioResumo';
import EstadoErro from './EstadoErro';
import { classificarErro } from './erros';
import { IconeFechar, IconeSeguir, IconeEditar } from './icons';
import './PaginaPerfil.css';

function ModalListaUsuarios({ titulo, tipo, itens, carregando, erro, onRetentar, onFechar }) {
  const { t } = useTranslation('users');
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

        {erro ? (
          <EstadoErro erro={erro} onRetentar={onRetentar} tamanho="inline" />
        ) : (
          <>
            {carregando && <p className="modal-usuarios__vazio">{t('perfil.lista_usuarios.carregando')}</p>}
            {!carregando && itens.length === 0 && (
              <p className="modal-usuarios__vazio">
                {ehLugares ? t('perfil.lista_usuarios.nenhum_lugar') : t('perfil.lista_usuarios.ninguem_por_aqui')}
              </p>
            )}
            {!carregando && (
              ehLugares
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
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ModalSelecaoBadge({ conquistas, idAtual, selecionando, carregando, erro, erroSelecao, onRetentar, onSelecionar, onFechar }) {
  const { t } = useTranslation('gamification');
  const grupos = conquistas.reduce((acc, c) => {
    const chave = c.badge.tipo_nome;
    (acc[chave] = acc[chave] || []).push(c);
    return acc;
  }, {});

  return (
    <div onClick={onFechar} className="modal-overlay">
      <div onClick={(e) => e.stopPropagation()} className="modal-box modal-box--grande">
        <div className="modal-box__header">
          <strong>{t('modal_badge.titulo')}</strong>
          <button onClick={onFechar} className="modal-box__fechar">
            <IconeFechar size={18} />
          </button>
        </div>

        {erro ? (
          <EstadoErro erro={erro} onRetentar={onRetentar} tamanho="inline" />
        ) : (
          <>
            {erroSelecao && <p className="modal-editar__erro">{erroSelecao}</p>}

            <button
              onClick={() => onSelecionar(null)}
              disabled={selecionando}
              className={`modal-badge__opcao${idAtual == null ? ' modal-badge__opcao--selecionada' : ''}`}
            >
              {t('modal_badge.nenhuma_exibida')}
            </button>

            {carregando && <p className="modal-badge__vazio">{t('modal_badge.carregando')}</p>}
            {!carregando && conquistas.length === 0 && (
              <p className="modal-badge__vazio">{t('modal_badge.vazio')}</p>
            )}

            {!carregando && Object.entries(grupos).map(([tipoNome, itens]) => (
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
          </>
        )}
      </div>
    </div>
  );
}

function ModalEditarPerfil({ me, salvando, erro, onSalvar, onFechar }) {
  const { t } = useTranslation('users');
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
          <strong>{t('perfil.modal_editar.titulo')}</strong>
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

        <label className="modal-editar__label">{t('perfil.modal_editar.nome_exibicao_label')}</label>
        <input
          value={nomeExibicao}
          onChange={(e) => setNomeExibicao(e.target.value)}
          maxLength={50}
          className="modal-editar__input"
        />
        {cooldownAtivo && (
          <p className={`modal-editar__cooldown-aviso${nomeMudou ? ' modal-editar__cooldown-aviso--bloqueado' : ''}`}>
            {nomeMudou
              ? t('perfil.modal_editar.cooldown_bloqueado', { count: me.dias_para_trocar_nome_exibicao })
              : t('perfil.modal_editar.cooldown_info', { count: me.dias_para_trocar_nome_exibicao })}
          </p>
        )}
        {!cooldownAtivo && <div className="modal-editar__espaco" />}

        <label className="modal-editar__label">{t('perfil.modal_editar.bio_label')}</label>
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
          {salvando ? t('perfil.modal_editar.salvando') : t('perfil.modal_editar.salvar')}
        </button>
      </div>
    </div>
  );
}

function PaginaPerfil() {
  const { t } = useTranslation('users');
  const { username } = useParams();
  const usuarioLogado = getUsuarioLogado();
  const [perfil, setPerfil] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [aba, setAba] = useState('publicados');
  const [enviandoFollow, setEnviandoFollow] = useState(false);
  const [erroFollow, setErroFollow] = useState(null);
  const [modalAberto, setModalAberto] = useState(null);
  const [listaModal, setListaModal] = useState([]);
  const [carregandoModalLista, setCarregandoModalLista] = useState(false);
  const [erroModalLista, setErroModalLista] = useState(null);

  const [modalBadgeAberto, setModalBadgeAberto] = useState(false);
  const [conquistas, setConquistas] = useState([]);
  const [carregandoConquistas, setCarregandoConquistas] = useState(false);
  const [erroConquistas, setErroConquistas] = useState(null);
  const [selecionandoBadge, setSelecionandoBadge] = useState(false);
  const [erroBadge, setErroBadge] = useState(null);
  const [badgeDestaqueRealId, setBadgeDestaqueRealId] = useState(usuarioLogado?.badge_destaque?.id ?? null);

  const [configuracoes, setConfiguracoes] = useState(null);
  const [salvandoConfig, setSalvandoConfig] = useState(false);

  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [meEdicao, setMeEdicao] = useState(null);
  const [carregandoEdicao, setCarregandoEdicao] = useState(false);
  const [erroCarregarEdicao, setErroCarregarEdicao] = useState(null);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [erroEdicao, setErroEdicao] = useState(null);

  async function buscarPerfil() {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await api.get(`/users/${username}/`);
      setPerfil(resposta.data);
    } catch (err) {
      setErro(classificarErro(err));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (username) buscarPerfil();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const ehProprioPerfil = usuarioLogado?.username === username;

  useEffect(() => {
    if (!ehProprioPerfil) return;
    getConfiguracoes().then(setConfiguracoes).catch(() => {});
  }, [ehProprioPerfil]);

  async function alternarSeguir() {
    if (enviandoFollow) return;
    setEnviandoFollow(true);
    setErroFollow(null);
    try {
      const resposta = await api.post('/social/follow/', { tipo: 'usuario', alvo_id: perfil.id });
      const { seguindo, solicitado } = resposta.data;

      setPerfil((prev) => {
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
      setErroFollow(classificarErro(err).mensagem);
    } finally {
      setEnviandoFollow(false);
    }
  }

  async function abrirModal(tipo) {
    setModalAberto(tipo);
    setListaModal([]);
    setErroModalLista(null);
    setCarregandoModalLista(true);
    try {
      const resposta = await api.get(`/social/usuarios/${username}/${tipo}/`);
      setListaModal(resposta.data);
    } catch (err) {
      setErroModalLista(classificarErro(err));
    } finally {
      setCarregandoModalLista(false);
    }
  }

  function retentarModalLista() {
    if (modalAberto) abrirModal(modalAberto);
  }

  async function abrirModalBadge() {
    setModalBadgeAberto(true);
    setErroBadge(null);
    setErroConquistas(null);
    setCarregandoConquistas(true);
    try {
      const dados = await getMinhasConquistas();
      setConquistas(dados);
    } catch (err) {
      setErroConquistas(classificarErro(err));
    } finally {
      setCarregandoConquistas(false);
    }
  }

  async function handleSelecionarBadge(badgeId) {
    if (selecionandoBadge) return;
    setSelecionandoBadge(true);
    setErroBadge(null);
    try {
      const meAtualizado = await selecionarBadgeDestaque(badgeId);
      setBadgeDestaqueRealId(meAtualizado.badge_destaque?.id ?? null);
      setPerfil((prev) => ({ ...prev, badge_destaque: meAtualizado.exibir_badges ? meAtualizado.badge_destaque : null }));
      setModalBadgeAberto(false);
    } catch (err) {
      setErroBadge(classificarErro(err).mensagem);
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
      setPerfil((prev) => ({ ...prev, badge_destaque: atualizado.exibir_badges ? prev.badge_destaque : null }));
      if (atualizado.exibir_badges) buscarPerfil();
    } catch (_) {} finally {
      setSalvandoConfig(false);
    }
  }

  async function abrirModalEditar() {
    setErroEdicao(null);
    setErroCarregarEdicao(null);
    setMeEdicao(null);
    setModalEditarAberto(true);
    setCarregandoEdicao(true);
    try {
      const me = await getMe();
      setMeEdicao(me);
    } catch (err) {
      setErroCarregarEdicao(classificarErro(err));
    } finally {
      setCarregandoEdicao(false);
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
        || classificarErro(err).mensagem;
      setErroEdicao(mensagem);
    } finally {
      setSalvandoPerfil(false);
    }
  }

  function handleRascunhoExcluido(idExcluido) {
    setPerfil((prev) => ({
      ...prev,
      rascunhos: (prev.rascunhos || []).filter((r) => r.id !== idExcluido),
    }));
  }

  if (carregando) return <p className="pagina-perfil__carregando">{t('perfil.carregando')}</p>;
  if (erro && !perfil) return <EstadoErro erro={erro} onRetentar={buscarPerfil} tamanho="pagina" />;
  if (!perfil) return null;

  const abas = [
    { key: 'publicados', label: t('perfil.aba_publicados') },
    ...(perfil.salvos ? [{ key: 'salvos', label: t('perfil.aba_salvos') }] : []),
    ...(perfil.rascunhos ? [{ key: 'rascunhos', label: t('perfil.aba_rascunhos') }] : []),
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
                {perfil.voce_segue ? t('perfil.seguindo') : perfil.solicitado ? t('perfil.solicitacao_enviada') : t('perfil.seguir')}
              </button>
            )}
          </div>
          {perfil.bio && <p className="perfil-header__bio">{perfil.bio}</p>}
          <p className="perfil-header__stats">
            {perfil.total_seguidores !== null ? (
              <button onClick={() => abrirModal('seguidores')} className="perfil-header__stats-link">
                <strong>{perfil.total_seguidores}</strong> {t('perfil.seguidores')}
              </button>
            ) : (
              <span className="perfil-header__stats-link" style={{ opacity: 0.6, cursor: 'default' }}>
                <strong>--</strong> {t('perfil.seguidores')}
              </span>
            )}
            {' · '}
            {perfil.total_seguindo_usuarios !== null ? (
              <button onClick={() => abrirModal('seguindo')} className="perfil-header__stats-link">
                <strong>{perfil.total_seguindo_usuarios}</strong> {t('perfil.usuarios_seguidos')}
              </button>
            ) : (
              <span className="perfil-header__stats-link" style={{ opacity: 0.6, cursor: 'default' }}>
                <strong>--</strong> {t('perfil.usuarios_seguidos')}
              </span>
            )}
            {(perfil.total_seguindo_lugares > 0 || perfil.total_seguindo_lugares === null) && (
              <>
                {' · '}
                {perfil.total_seguindo_lugares !== null ? (
                  <button onClick={() => abrirModal('lugares')} className="perfil-header__stats-link">
                    <strong>{perfil.total_seguindo_lugares}</strong> {t('perfil.lugar_seguido', { count: perfil.total_seguindo_lugares })}
                  </button>
                ) : (
                  <span className="perfil-header__stats-link" style={{ opacity: 0.6, cursor: 'default' }}>
                    <strong>--</strong> {t('perfil.lugar_seguido', { count: 0 })}
                  </span>
                )}
              </>
            )}
          </p>
        </div>
      </div>

      {erroFollow && <p className="perfil-erro">{erroFollow}</p>}

      {ehProprioPerfil && (
        <div className="painel-gerenciamento">
          <div className="painel-gerenciamento__linha">
            <span className="painel-gerenciamento__titulo">{t('perfil.seu_perfil')}</span>
            <button onClick={abrirModalEditar} className="btn-secundario btn-secundario--compacto">
              {t('perfil.editar_perfil')}
            </button>
          </div>

          <div className={`painel-gerenciamento__linha${!configuracoes ? ' painel-gerenciamento__linha--sem-margem' : ''}`}>
            <span className="painel-gerenciamento__titulo">{t('perfil.suas_badges')}</span>
            <button onClick={abrirModalBadge} className="btn-secundario btn-secundario--compacto">
              {t('perfil.escolher_destaque')}
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
              {t('perfil.exibir_badges_publicamente')}
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
        <p className="perfil-lista-vazia">{t('perfil.nenhum_itinerario_aqui')}</p>
      )}

      <div className="grid-itinerarios">
        {itinerariosAba.map((it) => (
          <CardItinerarioResumo key={it.id} it={it} onExcluido={handleRascunhoExcluido} />
        ))}
      </div>

      {modalAberto && (
        <ModalListaUsuarios
          titulo={
            modalAberto === 'seguidores' ? t('perfil.lista_usuarios.titulo_seguidores')
              : modalAberto === 'seguindo' ? t('perfil.lista_usuarios.titulo_seguindo')
              : t('perfil.lista_usuarios.titulo_lugares')
          }
          tipo={modalAberto}
          itens={listaModal}
          carregando={carregandoModalLista}
          erro={erroModalLista}
          onRetentar={retentarModalLista}
          onFechar={() => setModalAberto(null)}
        />
      )}

      {modalBadgeAberto && (
        <ModalSelecaoBadge
          conquistas={conquistas}
          idAtual={badgeDestaqueRealId}
          selecionando={selecionandoBadge}
          carregando={carregandoConquistas}
          erro={erroConquistas}
          erroSelecao={erroBadge}
          onRetentar={abrirModalBadge}
          onSelecionar={handleSelecionarBadge}
          onFechar={() => { setModalBadgeAberto(false); setErroBadge(null); }}
        />
      )}

      {modalEditarAberto && !meEdicao && (
        <div onClick={() => setModalEditarAberto(false)} className="modal-overlay">
          <div onClick={(e) => e.stopPropagation()} className="modal-box modal-box--media">
            <div className="modal-box__header">
              <strong>{t('perfil.modal_editar.titulo')}</strong>
              <button onClick={() => setModalEditarAberto(false)} className="modal-box__fechar">
                <IconeFechar size={18} />
              </button>
            </div>
            {carregandoEdicao
              ? <p className="modal-usuarios__vazio">{t('perfil.lista_usuarios.carregando')}</p>
              : <EstadoErro erro={erroCarregarEdicao} onRetentar={abrirModalEditar} tamanho="inline" />
            }
          </div>
        </div>
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
    </div>
  );
}

export default PaginaPerfil;