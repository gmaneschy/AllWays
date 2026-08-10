// Rotas "full-page" que não mostram Navbar — hoje usado tanto pelo
// App.jsx (zera o margin-left do <main> reservado pra Navbar) quanto pelo
// Navbar.jsx (o componente se recusa a renderizar nelas). Antes essa lista
// vivia duplicada nos dois arquivos e cada um citava "ver o outro arquivo"
// nos comentários — bastou uma rota nova (/ativar-conta) ser adicionada
// num lugar só pra Navbar voltar a aparecer onde não devia. Centralizando
// aqui, os dois arquivos sempre concordam.
const PREFIXOS_SEM_NAVBAR = ['/login', '/ativar-conta'];

export function PaginaSemNavbar(pathname) {
  return PREFIXOS_SEM_NAVBAR.some(
    (prefixo) => pathname === prefixo || pathname.startsWith(`${prefixo}/`)
  );
}
