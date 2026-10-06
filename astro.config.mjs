// @ts-check
import { defineConfig } from 'astro/config';

// BASE_PATH vem do build do Lotus_site (/amenezes-imobiliaria/). Sem ele, o site mora na raiz do domínio do cliente.
const BASE = process.env.BASE_PATH ?? '/';
const PREVIA = BASE !== '/';
const b = (p) => BASE.replace(/\/$/, '') + p;

export default defineConfig({
  site: PREVIA ? 'https://lotusdev.com.br' : 'https://amenezes.com.br',
  base: BASE,
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'always' },
  // 301 das URLs antigas (em produção, replicar no .htaccess — ver ARCHITECTURE.md §2)
  redirects: {
    '/todos-os-imoveis-2': b('/imoveis/'),
    '/todos-os-imoveis': b('/imoveis/'),
    '/loja': b('/tipo-de-negocio/aluguel_temporada/'),
  },
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  vite: {
    build: { chunkSizeWarningLimit: 1600 },
  },
});
