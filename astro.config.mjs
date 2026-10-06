// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// BASE_PATH: caminho em que o site é servido (/amenezes-imobiliaria/ na Lotus). Sem ele, raiz do domínio do cliente.
const BASE = process.env.BASE_PATH ?? '/';
const PREVIA = BASE !== '/';
const b = (p) => BASE.replace(/\/$/, '') + p;

export default defineConfig({
  site: PREVIA ? 'https://lotusdev.com.br' : 'https://amenezes.com.br',
  base: BASE,
  trailingSlash: 'always',
  // Servidor Node: páginas montadas a cada visita a partir do banco do painel (alteração aparece na hora)
  output: 'server',
  adapter: node({ mode: 'standalone', bodySizeLimit: 15 * 1024 * 1024 }),
  // Bloqueia POST vindo de outro site (CSRF) em todas as rotas.
  // allowedDomains: domínios cujos cabeçalhos X-Forwarded-* (do Traefik) são confiáveis → URL https correta e IP real.
  security: {
    checkOrigin: true,
    allowedDomains: ['lotusdev.com.br', 'amenezes.com.br', 'www.amenezes.com.br'].map((hostname) => ({ hostname, protocol: 'https' })),
  },
  build: { format: 'directory', inlineStylesheets: 'always' },
  // 301 das URLs antigas
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
