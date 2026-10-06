// Sitemap completo (o atual só tinha as taxonomias — os 301 imóveis ficavam de fora)
import { publicados, taxonomiasDe } from '../lib/imoveis';
import { brand } from '../../brand.config';

export function GET() {
  const imoveis = publicados();
  const taxonomias = taxonomiasDe(imoveis);
  const fixas = ['/', '/imoveis/', '/tipo-de-negocio/venda/', '/tipo-de-negocio/alugar/', '/tipo-de-negocio/aluguel_temporada/',
    '/financiamento-proprio/', '/sobre-nos/', '/contato/', '/cadastre-seu-imovel/', '/politica-de-privacidade/'];
  const urls = [
    ...fixas.map((u) => ({ u })),
    ...taxonomias.tipos.map((t) => ({ u: `/tipo-de-imovel/${t.slug}/` })),
    ...imoveis.map((i) => ({ u: i.url, m: i.modificado.slice(0, 10) })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((x) => `  <url><loc>${brand.site}${x.u}</loc>${x.m ? `<lastmod>${x.m}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
