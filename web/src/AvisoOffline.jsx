import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import './AvisoOffline.css';

// Detecta offline/online via evento do navegador — não depende de nenhuma
// requisição ter falhado primeiro. Complementa o EstadoErro: aquele reage
// a UMA chamada que deu erro; este avisa a queda de conexão em si, mesmo
// numa tela que não está buscando nada no momento.
//
// Montar uma vez em App.jsx, acima das <Routes>, igual à <Navbar />.
function AvisoOffline() {
  const [online, setOnline] = useState(navigator.onLine);
  // Depois de voltar a ficar online, mostra um aviso rápido de confirmação
  // e some sozinho — evita deixar o usuário na dúvida se reconectou de fato.
  const [mostrarReconectado, setMostrarReconectado] = useState(false);

  useEffect(() => {
    function aoFicarOffline() {
      setOnline(false);
      setMostrarReconectado(false);
    }
    function aoFicarOnline() {
      setOnline(true);
      setMostrarReconectado(true);
      setTimeout(() => setMostrarReconectado(false), 3000);
    }
    window.addEventListener('offline', aoFicarOffline);
    window.addEventListener('online', aoFicarOnline);
    return () => {
      window.removeEventListener('offline', aoFicarOffline);
      window.removeEventListener('online', aoFicarOnline);
    };
  }, []);

  if (online && !mostrarReconectado) return null;

  return (
    <div className={`aviso-offline${online ? ' aviso-offline--reconectado' : ''}`} role="status">
      {online
        ? <><Wifi size={15} /> Conexão restabelecida</>
        : <><WifiOff size={15} /> Você está sem conexão — algumas ações podem falhar</>
      }
    </div>
  );
}

export default AvisoOffline;
