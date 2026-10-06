// Sincroniza os imóveis do WordPress atual → src/data/imoveis.json
// Base: API REST pública (título, taxonomias, foto de capa).
// Complemento: HTML público de cada imóvel (preço, ficha, descrição, galeria, mapa).
// ponytail: a leitura do HTML é uma ponte até o mu-plugin expor os campos do JetEngine na API (ver ARCHITECTURE.md §3).
import { parse } from 'node-html-parser';
import { writeFile, mkdir } from 'node:fs/promises';

const WP = 'https://amenezes.com.br';
const UA = { headers: { 'User-Agent': 'Mozilla/5.0 (A.Menezes sync)' } };
const getJSON = async (path) => (await fetch(WP + path, UA)).json();
const getText = async (url) => (await fetch(url, UA)).text();

// Apelidos de taxonomia suja → nome canônico (limpeza definitiva deve ser feita no painel)
const BAIRRO_ALIAS = { 'Morobá': 'Marobá', 'Belo Horizonte Otil': 'Belo Horizonte', 'Esplanada II': 'Esplanada' };
const BAIRRO_INVALIDO = new Set(['TERRENO', 'ÁREA DE TERRENO']);
const FINALIDADE = { 'Aluguel Anual': 'anual', 'Aluguel Temporada': 'temporada', 'Venda': 'venda' };

const decode = (s) => parse(`<p>${s}</p>`).text.trim();
const num = (s) => {
  if (s == null) return null;
  const m = String(s).replace(/\s/g, '').match(/[\d.,]+/);
  if (!m) return null;
  const n = parseFloat(m[0].replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

async function pagedAll(path) {
  const out = [];
  for (let p = 1; ; p++) {
    const res = await fetch(`${WP}${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${p}`, UA);
    if (!res.ok) break;
    const data = await res.json();
    out.push(...data);
    if (p >= Number(res.headers.get('x-wp-totalpages') || 1)) break;
  }
  return out;
}

// Limpa a descrição: mantém só a estrutura de texto e tabelas
function cleanHtml(node) {
  if (!node) return '';
  const KEEP = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th']);
  const walk = (n) => n.childNodes.map((c) => {
    if (c.nodeType === 3) return c.rawText;
    const tag = c.rawTagName?.toLowerCase();
    const inner = walk(c);
    if (tag === 'b') return `<strong>${inner}</strong>`;
    return KEEP.has(tag) ? (tag === 'br' ? '<br>' : `<${tag}>${inner}</${tag}>`) : inner;
  }).join('');
  return walk(node).replace(/&nbsp;/g, ' ').replace(/<p>\s*<\/p>/g, '').replace(/\s+/g, ' ').trim();
}

function parseImovel(html) {
  const root = parse(html);
  const main = root.querySelector('[data-elementor-type="single-post"]') || root.querySelector('[data-elementor-type^="single"]');
  if (!main) return null;
  // Tudo depois de "Imóveis Similares" é de outros imóveis
  const cutAt = main.innerHTML.indexOf('Imóveis Similares');
  const scope = parse(cutAt > 0 ? main.innerHTML.slice(0, cutAt) : main.innerHTML);

  const out = { precos: [], specs: {} };
  const nodes = scope.querySelectorAll('h1,h2,h3,.jet-listing-dynamic-field__content,.elementor-icon-list-text');
  let afterH1 = false, inDesc = false;
  for (const n of nodes) {
    const t = n.text.replace(/\s+/g, ' ').trim();
    if (!t) continue;
    const isField = n.classList.contains('jet-listing-dynamic-field__content');
    const preco = t.length < 90 && t.match(/^(.*?(?:Preço|Valor|Aluguel|IPTU|Diária|Condomínio)[^:]*):\s*R\$\s*([\d.,]+)/i);
    if (isField && preco) {
      const item = { rotulo: preco[1].trim(), valor: num(preco[2]) };
      if (!out.precos.some((x) => x.rotulo === item.rotulo)) out.precos.push(item);
      continue;
    }
    const cod = t.match(/^Código do Imóvel:\s*(.+)$/i);
    if (cod) { out.codigo = cod[1].trim(); continue; }
    if (n.tagName === 'H1') { out.titulo = t; afterH1 = true; continue; }
    if (t === 'Descrição do Imóvel') { inDesc = true; continue; }
    if (inDesc && isField) { out.descricaoHtml = cleanHtml(n); inDesc = false; continue; }
    if (isField && afterH1 && !out.endereco) { out.endereco = t; continue; }
    if (isField && !afterH1 && !out.subtitulo) { out.subtitulo = t; continue; }
    const spec = t.match(/^(Quartos|Banheiros?|Garagem|Tamanho|Área|Qtde de pessoas|Suítes?)\s*:\s*(.+)$/i);
    if (spec && !n.closest?.('.swiper')) {
      const k = { quartos: 'quartos', banheiro: 'banheiros', banheiros: 'banheiros', garagem: 'garagem', tamanho: 'area', 'área': 'area', 'qtde de pessoas': 'pessoas', 'suíte': 'suites', 'suítes': 'suites' }[spec[1].toLowerCase()];
      if (k && out.specs[k] == null) out.specs[k] = spec[2].trim();
    }
  }

  // Galeria: link = original (lightbox), img = recorte do carrossel
  out.fotos = scope.querySelectorAll('.swiper-slide').map((s) => {
    const a = s.querySelector('a'); const img = s.querySelector('img');
    return { full: a?.getAttribute('href'), src: img?.getAttribute('data-src') || img?.getAttribute('src') };
  }).filter((f) => f.full && /\.(jpe?g|png|webp)$/i.test(f.full));
  // remove duplicadas (carrossel em loop)
  out.fotos = [...new Map(out.fotos.map((f) => [f.full, f])).values()];

  const map = html.match(/maps\?q=(-?\d+\.\d+)%2C(-?\d+\.\d+)/);
  if (map) out.geo = { lat: +map[1], lng: +map[2] };
  const yt = html.match(/(?:youtube\.com\/embed\/|youtu\.be\/|youtube\.com\/watch\?v=)([\w-]{11})/);
  if (yt) out.video = yt[1];
  return out;
}

async function pool(items, size, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

const main = async () => {
  console.log('→ API REST…');
  const [posts, tCidade, tBairro, tCarac, tTipo, tNeg] = await Promise.all([
    pagedAll('/wp-json/wp/v2/cadastro-de-imoveis?_fields=id,slug,link,title,modified,featured_media,cidade,bairros,caracteristicas-do-imovel,tipo-de-imovel,tipo-de-negocio'),
    ...['cidade', 'bairros', 'caracteristicas-do-imovel', 'tipo-de-imovel', 'tipo-de-negocio'].map((t) => pagedAll(`/wp-json/wp/v2/${t}?_fields=id,name,slug,count`)),
  ]);
  const byId = (list) => Object.fromEntries(list.map((t) => [t.id, { ...t, name: decode(t.name) }]));
  const [C, B, K, T, N] = [tCidade, tBairro, tCarac, tTipo, tNeg].map(byId);

  // Capas com todos os tamanhos (lotes de 100)
  const mediaIds = [...new Set(posts.map((p) => p.featured_media).filter(Boolean))];
  const media = {};
  for (let i = 0; i < mediaIds.length; i += 100) {
    const batch = await getJSON(`/wp-json/wp/v2/media?include=${mediaIds.slice(i, i + 100).join(',')}&per_page=100&_fields=id,source_url,alt_text,media_details`);
    for (const m of batch) media[m.id] = m;
  }

  console.log(`→ ${posts.length} páginas de imóvel…`);
  let done = 0;
  const imoveis = (await pool(posts, 6, async (p) => {
    let extra = null;
    try { extra = parseImovel(await getText(p.link)); } catch (e) { console.warn('  falhou', p.link, e.message); }
    if (++done % 25 === 0) console.log(`  ${done}/${posts.length}`);
    const cover = media[p.featured_media];
    const sizes = cover?.media_details?.sizes || {};
    const pick = (...ks) => ks.map((k) => sizes[k]).find(Boolean);
    const card = pick('medium_large', 'large', 'full');
    const bairroRaw = (p.bairros || []).map((id) => B[id]?.name).filter((n) => n && !BAIRRO_INVALIDO.has(n))[0];
    const finalidadeNome = N[(p['tipo-de-negocio'] || [])[0]]?.name;
    const s = extra?.specs || {};
    const precoVenda = extra?.precos.find((x) => /venda/i.test(x.rotulo))?.valor ?? null;
    const aluguel = extra?.precos.find((x) => /aluguel|mensal/i.test(x.rotulo))?.valor ?? null;
    const iptu = extra?.precos.find((x) => /iptu/i.test(x.rotulo))?.valor ?? null;
    return {
      id: p.id,
      slug: p.slug,
      url: new URL(p.link).pathname,
      linkOriginal: p.link,
      codigo: extra?.codigo || '',
      titulo: extra?.titulo || decode(p.title.rendered),
      subtitulo: extra?.subtitulo || '',
      finalidade: FINALIDADE[finalidadeNome] || 'venda',
      tipo: T[(p['tipo-de-imovel'] || [])[0]]?.name || 'Imóvel',
      tipoSlug: T[(p['tipo-de-imovel'] || [])[0]]?.slug || '',
      bairro: BAIRRO_ALIAS[bairroRaw] || bairroRaw || '',
      cidade: C[(p.cidade || [])[0]]?.name?.replace(' - ES', '') || 'Marataízes',
      endereco: extra?.endereco || '',
      quartos: num(s.quartos), banheiros: num(s.banheiros), garagem: num(s.garagem),
      suites: num(s.suites), area: num(s.area), pessoas: num(s.pessoas),
      preco: precoVenda, aluguel, iptu,
      precos: extra?.precos || [],
      caracteristicas: (p['caracteristicas-do-imovel'] || []).map((id) => K[id]?.name).filter(Boolean),
      descricaoHtml: extra?.descricaoHtml || '',
      capa: cover ? {
        src: card?.source_url || cover.source_url,
        srcset: ['medium', 'medium_large', 'large', 'full'].map((k) => sizes[k] && `${sizes[k].source_url} ${sizes[k].width}w`).filter(Boolean).join(', '),
        w: card?.width || 768, h: card?.height || 576, alt: cover.alt_text || '',
      } : null,
      fotos: extra?.fotos || [],
      geo: extra?.geo || null,
      video: extra?.video || null,
      modificado: p.modified,
    };
  }));

  const taxonomias = {
    tipos: Object.values(T).filter((t) => t.count > 0).map(({ name, slug, count }) => ({ name, slug, count })),
    bairros: Object.entries(imoveis.reduce((a, i) => (i.bairro && (a[i.bairro] = (a[i.bairro] || 0) + 1), a), {}))
      .map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    finalidades: ['venda', 'anual', 'temporada'].map((f) => ({ slug: f, count: imoveis.filter((i) => i.finalidade === f).length })),
  };

  await mkdir('src/data', { recursive: true });
  await writeFile('src/data/imoveis.json', JSON.stringify(imoveis));
  await writeFile('src/data/taxonomias.json', JSON.stringify(taxonomias, null, 2));
  const semPreco = imoveis.filter((i) => i.preco == null && i.aluguel == null).length;
  console.log(`✔ ${imoveis.length} imóveis · ${semPreco} sem preço publicado · ${imoveis.filter((i) => i.geo).length} com coordenadas`);
};

main();
