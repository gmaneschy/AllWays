/*
  icons.jsx — ponto único de importação de ícones do AllWays.

  Por que existir:
  - Nomes semânticos (IconeNotificacao) em vez de nomes da lib (Bell),
    então se um dia trocarmos de biblioteca de ícones, só este arquivo muda.
  - Tamanho e espessura padrão consistentes em todo o app, sem repetir
    `size={20} strokeWidth={2}` em cada componente.
  - Cor não é definida aqui de propósito: os ícones do lucide usam
    `currentColor` por padrão, então herdam a cor do texto do elemento
    pai via CSS — é assim que o hover coral do Navbar funciona, por exemplo.

  Como usar:
    import { IconeNotificacao } from './icons';
    <IconeNotificacao />                  // tamanho/espessura padrão
    <IconeNotificacao size={24} />        // sobrescreve só o que precisar
*/

import {
  Bell,
  Heart,
  UserPlus,
  MessageCircle,
  Share2,
  Users,
  Shield,
  DollarSign,
  User,
  CornerUpLeft,
  Search,
  MapPin,
  FolderOpen,
  Save,
  Film,
  Check,
  X,
  Plus,
  Pencil,
  Mail,
  Lock,
  AlertCircle,
  Clock,
  ArrowDown,
  Paperclip,
  Mic,
  Square,
  Loader2,
  Hash,
  Settings,
  CheckCheck,
  Trash2,
  RefreshCw,
  Maximize2,
  Volume2,
  VolumeX,
  Play,
  ChevronLeft,
  ChevronRight,
  Circle,
  Pin,
  Flag,
  Home,
  Compass,
  SquarePlus,
  LogOut,
  LogIn,
  Send,
  Upload,
  Copy,
} from 'lucide-react';

export const TAMANHO_PADRAO_ICONE = 20;
export const ESPESSURA_PADRAO_ICONE = 2;

function criarIcone(LucideIcon) {
  function IconeComponent({ size = TAMANHO_PADRAO_ICONE, strokeWidth = ESPESSURA_PADRAO_ICONE, ...props }) {
    return <LucideIcon size={size} strokeWidth={strokeWidth} {...props} />;
  }
  return IconeComponent;
}

export const IconeNotificacao = criarIcone(Bell);
export const IconeLike = criarIcone(Heart);
export const IconeSeguir = criarIcone(UserPlus);
export const IconeMensagem = criarIcone(MessageCircle);
export const IconeCompartilhar = criarIcone(Share2);
export const IconeMovimentacao = criarIcone(Users);
export const IconeSeguranca = criarIcone(Shield);
export const IconePreco = criarIcone(DollarSign);
export const IconeUsuario = criarIcone(User);
export const IconeResposta = criarIcone(CornerUpLeft);
export const IconeBuscar = criarIcone(Search);
export const IconePin = criarIcone(MapPin);
export const IconeCarregar = criarIcone(FolderOpen);
export const IconeSalvar = criarIcone(Save);
export const IconeVideo = criarIcone(Film);
export const IconeSucesso = criarIcone(Check);
export const IconeFechar = criarIcone(X);
export const IconeAdicionar = criarIcone(Plus);
export const IconeEditar = criarIcone(Pencil);
export const IconeEmail = criarIcone(Mail);
export const IconeSenha = criarIcone(Lock);
export const IconeAlerta = criarIcone(AlertCircle);
export const IconeHorario = criarIcone(Clock);
export const IconeProximaParada = criarIcone(ArrowDown);
export const IconeAnexo = criarIcone(Paperclip);
export const IconeMicrofone = criarIcone(Mic);
export const IconePararGravacao = criarIcone(Square);
export const IconeCarregando = criarIcone(Loader2);
export const IconeHashtag = criarIcone(Hash);
export const IconeConfiguracoes = criarIcone(Settings);
export const IconeEnviado = criarIcone(Check);
export const IconeLidoDuplo = criarIcone(CheckCheck);
export const IconeRemover = criarIcone(Trash2);
export const IconeTrocar = criarIcone(RefreshCw);
export const IconeComentario = criarIcone(MessageCircle);
export const IconeExpandir = criarIcone(Maximize2);
export const IconeSom = criarIcone(Volume2);
export const IconeSomMudo = criarIcone(VolumeX);
export const IconePlay = criarIcone(Play);
export const IconeSetaEsquerda = criarIcone(ChevronLeft);
export const IconeSetaDireita = criarIcone(ChevronRight);
export const IconeDot = criarIcone(Circle);
export const IconeCarrosselPin = criarIcone(Pin);
export const IconeChegada = criarIcone(Flag);
export const IconeEnviar = criarIcone(Send);
export const IconeUpload = criarIcone(Upload);
export const IconeReplicar = criarIcone(Copy);
export const IconeDenunciar = criarIcone(Flag);

// ─── Navegação (sidebar) ──────────────────────────────────────────────
export const IconeInicio = criarIcone(Home);
export const IconeExplorarNav = criarIcone(Compass);
export const IconeCriarItinerario = criarIcone(SquarePlus);
export const IconeSair = criarIcone(LogOut);
export const IconeEntrar = criarIcone(LogIn);