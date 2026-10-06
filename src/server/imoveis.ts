// Imóveis no banco: leitura com cache em memória (invalidado a cada gravação) e gravação a partir do painel.
import { unlink } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { db, FOTOS_DIR } from './db';

export type Status = 'publicado' | 'rascunho' | 'arquivado';
export type Foto = { src: string; full: string; alt?: string };

type Linha = { id: number; slug: string; status: Status; dados: string; atualizado: string };

let cache: any[] | null = null;
const invalidar = () => { cache = null; };

// Monta o objeto que o site usa (capa = 1ª foto, url = mesma estrutura do site antigo)
function montar(l: Linha) {
  const d = JSON.parse(l.dados);
  const f: Foto | undefined = d.fotos?.[0];
  const capa = f ? { src: f.src, srcset: f.full && f.full !== f.src ? `${f.src} 800w, ${f.full} 1600w` : '', w: 800, h: 600, alt: f.alt || '' } : null;
  return { ...d, id: l.id, slug: l.slug, status: l.status, url: `/cadastro-de-imoveis/${l.slug}/`, capa, modificado: l.atualizado.replace(' ', 'T') };
}

function todasLinhas(): any[] {
  if (!cache) cache = (db.prepare('SELECT id, slug, status, dados, atualizado FROM imoveis ORDER BY atualizado DESC').all() as Linha[]).map(montar);
  return cache;
}

export const listarPublicados = () => todasLinhas().filter((i) => i.status === 'publicado');
export const listarTodos = () => todasLinhas();
export const porSlug = (slug: string) => listarPublicados().find((i) => i.slug === slug);
export const porId = (id: number) => todasLinhas().find((i) => i.id === id);

const slugify = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80) || 'imovel';

function slugLivre(base: string, ignorarId?: number) {
  let s = slugify(base), n = 2;
  const ocupado = (x: string) => !!db.prepare('SELECT 1 FROM imoveis WHERE slug = ? AND id IS NOT ?').get(x, ignorarId ?? null);
  while (ocupado(s)) s = `${slugify(base)}-${n++}`;
  return s;
}

const num = (v: unknown) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
const txt = (v: unknown, max = 300) => String(v ?? '').trim().slice(0, max);

// Converte texto simples do painel em HTML seguro (parágrafos e quebras); HTML importado já vem limpo
const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const paraHtml = (t: string) => t.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${escapar(p).replace(/\n/g, '<br>')}</p>`).join('');

// Valida e normaliza o que vem do formulário do painel
export function normalizar(e: any) {
  const finalidade = ['venda', 'anual', 'temporada'].includes(e.finalidade) ? e.finalidade : 'venda';
  const fotos: Foto[] = (Array.isArray(e.fotos) ? e.fotos : [])
    .filter((f: any) => f && typeof f.src === 'string' && /^(https:\/\/|\/)/.test(f.src))
    .slice(0, 80)
    .map((f: any) => ({ src: f.src, full: typeof f.full === 'string' ? f.full : f.src, alt: txt(f.alt, 160) }));
  const precos = [
    e.iptu && { rotulo: 'IPTU', valor: num(e.iptu) },
    e.condominio && { rotulo: 'Condomínio', valor: num(e.condominio) },
  ].filter(Boolean);
  return {
    codigo: txt(e.codigo, 40),
    titulo: txt(e.titulo, 160) || 'Imóvel sem título',
    subtitulo: '',
    finalidade,
    tipo: txt(e.tipo, 60) || 'Imóvel',
    tipoSlug: slugify(txt(e.tipo, 60) || 'imovel'),
    bairro: txt(e.bairro, 80),
    cidade: txt(e.cidade, 80) || 'Marataízes',
    endereco: txt(e.endereco, 200),
    quartos: num(e.quartos), banheiros: num(e.banheiros), suites: num(e.suites), garagem: num(e.garagem),
    area: num(e.area), pessoas: num(e.pessoas),
    preco: finalidade === 'venda' ? num(e.preco) : null,
    aluguel: finalidade === 'anual' ? num(e.aluguel) : null,
    iptu: num(e.iptu),
    precos,
    caracteristicas: (Array.isArray(e.caracteristicas) ? e.caracteristicas : []).map((c: any) => txt(c, 60)).filter(Boolean).slice(0, 60),
    descricaoHtml: e.descricaoTexto !== undefined ? paraHtml(String(e.descricaoTexto).slice(0, 20000)) : txt(e.descricaoHtml, 40000),
    financiamento: !!e.financiamento,
    destaque: !!e.destaque,
    fotos,
    geo: num(e.lat) != null && num(e.lng) != null ? { lat: num(e.lat), lng: num(e.lng) } : null,
    video: (String(e.video ?? '').match(/(?:youtu\.be\/|v=|embed\/)?([\w-]{11})(?:\b|$)/) || [])[1] || null,
    linkOriginal: txt(e.linkOriginal, 300),
  };
}

const statusValido = (s: unknown): Status => (s === 'rascunho' || s === 'arquivado' ? s : 'publicado');

export function criar(entrada: any) {
  const d = normalizar(entrada);
  const slug = slugLivre(d.titulo);
  const r = db.prepare("INSERT INTO imoveis (slug, status, dados, atualizado) VALUES (?, ?, ?, datetime('now'))").run(slug, statusValido(entrada.status), JSON.stringify(d));
  invalidar();
  return Number(r.lastInsertRowid);
}

export async function atualizar(id: number, entrada: any) {
  const atual = db.prepare('SELECT dados FROM imoveis WHERE id = ?').get(id) as { dados: string } | undefined;
  if (!atual) return false;
  const antigo = JSON.parse(atual.dados);
  // preserva campos que o formulário não edita (ex.: wpId, descrição importada quando não foi alterada)
  const d = { ...antigo, ...normalizar({ ...antigo, ...entrada }) };
  db.prepare("UPDATE imoveis SET dados = ?, status = ?, atualizado = datetime('now') WHERE id = ?").run(JSON.stringify(d), statusValido(entrada.status), id);
  invalidar();
  await apagarFotosOrfas(antigo.fotos, d.fotos);
  return true;
}

export async function excluir(id: number) {
  const atual = db.prepare('SELECT dados FROM imoveis WHERE id = ?').get(id) as { dados: string } | undefined;
  if (!atual) return false;
  db.prepare('DELETE FROM imoveis WHERE id = ?').run(id);
  invalidar();
  await apagarFotosOrfas(JSON.parse(atual.dados).fotos, []);
  return true;
}

// Remove do disco as fotos enviadas pelo painel que nenhum imóvel usa mais (cópias compartilham fotos)
async function apagarFotosOrfas(antes: Foto[] = [], depois: Foto[] = []) {
  const usadas = new Set([...depois, ...todasLinhas().flatMap((i) => i.fotos ?? [])].flatMap((f: Foto) => [f.src, f.full]));
  const nossas = antes.flatMap((f) => [f.src, f.full]).filter((u) => u && u.includes('/fotos/') && !usadas.has(u));
  await Promise.all(nossas.map((u) => unlink(join(FOTOS_DIR, basename(u))).catch(() => {})));
}

// Valores já usados, para o painel sugerir (tipos, bairros, características)
export function sugestoes() {
  const conta = (f: (i: any) => string[]) => [...new Set(todasLinhas().flatMap(f).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return {
    tipos: conta((i) => [i.tipo]),
    bairros: conta((i) => [i.bairro]),
    caracteristicas: conta((i) => i.caracteristicas || []),
  };
}
