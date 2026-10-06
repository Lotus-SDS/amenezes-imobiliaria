// Caminhos internos com o prefixo de publicação (BASE_PATH).
// Em produção no domínio do cliente o prefixo é "/"; na prévia da Lotus é "/amenezes-imobiliaria/".
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export const u = (caminho: string) => (caminho.startsWith('/') ? BASE + caminho : caminho);
