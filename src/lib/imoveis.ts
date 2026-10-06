// Acesso aos imóveis (banco do painel, via src/server/imoveis.ts) + formatação usada pelas páginas.
import { listarPublicados } from '../server/imoveis';
import { brand, waLink } from '../../brand.config';

export type Foto = { full: string; src: string; alt?: string };
export type Imovel = {
  id: number; slug: string; url: string; status: string; linkOriginal?: string;
  codigo: string; titulo: string; subtitulo?: string;
  finalidade: 'venda' | 'anual' | 'temporada'; tipo: string; tipoSlug: string;
  bairro: string; cidade: string; endereco: string;
  quartos: number | null; banheiros: number | null; garagem: number | null; suites: number | null;
  area: number | null; pessoas: number | null;
  preco: number | null; aluguel: number | null; iptu: number | null;
  precos: { rotulo: string; valor: number | null }[];
  caracteristicas: string[]; descricaoHtml: string;
  financiamento?: boolean; destaque?: boolean;
  capa: { src: string; srcset: string; w: number; h: number; alt: string } | null;
  fotos: Foto[]; geo: { lat: number; lng: number } | null; video: string | null; modificado: string;
};

// Lista publicada no momento da requisição (cache em memória no servidor, renovado a cada alteração do painel)
export const publicados = () => listarPublicados() as Imovel[];

// Tipos e bairros com contagem, calculados da lista atual
export function taxonomiasDe(lista: Imovel[]) {
  const tipos = new Map<string, { name: string; slug: string; count: number }>();
  const bairros = new Map<string, number>();
  for (const i of lista) {
    const t = tipos.get(i.tipoSlug) ?? { name: i.tipo, slug: i.tipoSlug, count: 0 };
    t.count++;
    tipos.set(i.tipoSlug, t);
    if (i.bairro) bairros.set(i.bairro, (bairros.get(i.bairro) ?? 0) + 1);
  }
  return {
    tipos: [...tipos.values()].filter((t) => t.slug).sort((a, b) => b.count - a.count),
    bairros: [...bairros].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
  };
}

export const FINALIDADES = {
  venda: { nome: 'Comprar', rotulo: 'Venda', url: '/tipo-de-negocio/venda/', cena: 'interna-venda' },
  anual: { nome: 'Alugar', rotulo: 'Aluguel anual', url: '/tipo-de-negocio/alugar/', cena: 'interna-anual' },
  temporada: { nome: 'Temporada', rotulo: 'Temporada', url: '/tipo-de-negocio/aluguel_temporada/', cena: 'interna-temporada' },
} as const;
export type Finalidade = keyof typeof FINALIDADES;

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
export const reais = (v: number | null | undefined) => (v ? brl.format(v) : '');

export function precoPrincipal(i: Imovel) {
  if (i.finalidade === 'venda' && i.preco) return { valor: reais(i.preco), sufixo: '' };
  if (i.finalidade === 'anual' && i.aluguel) return { valor: reais(i.aluguel), sufixo: '/mês' };
  if (i.finalidade === 'temporada') return { valor: 'Reserva online', sufixo: '' };
  return { valor: 'Consulte', sufixo: '' };
}

export const temFinanciamento = (i: Imovel) => !!i.financiamento || /financ/i.test(i.descricaoHtml);

export const local = (i: Imovel) => [i.bairro, i.cidade].filter(Boolean).join(' · ');

export function specs(i: Imovel) {
  const s: string[] = [];
  if (i.quartos) s.push(`${i.quartos} ${i.quartos === 1 ? 'quarto' : 'quartos'}`);
  if (i.banheiros) s.push(`${i.banheiros} ${i.banheiros === 1 ? 'banheiro' : 'banheiros'}`);
  if (i.garagem) s.push(`${i.garagem} ${i.garagem === 1 ? 'vaga' : 'vagas'}`);
  if (i.area) s.push(`${i.area.toLocaleString('pt-BR')} m²`);
  if (i.pessoas && i.finalidade === 'temporada') s.push(`até ${i.pessoas} pessoas`);
  return s;
}

// Mensagem do WhatsApp já com o imóvel — o Sérgio não precisa perguntar "qual?"
export const waImovel = (i: Imovel) =>
  waLink(`Olá! Tenho interesse no imóvel ${i.codigo ? `cód. ${i.codigo} – ` : ''}${i.titulo}: ${brand.site}${i.url}`);
export const waVisita = (i: Imovel) =>
  waLink(`Olá! Quero agendar uma visita ao imóvel ${i.codigo ? `cód. ${i.codigo} – ` : ''}${i.titulo}: ${brand.site}${i.url}`);


// Título limpo: o cadastro tem nomes internos em CAIXA ALTA ("CASA MARCELO", "LOTE LENECY E ERALDO")
// Tipo do imóvel; quando o cadastro não tem, deduz do título ("CASA MARCELO" → Casa)
export function tipoDe(i: Imovel) {
  if (i.tipo !== 'Imóvel') return i.tipo;
  const m = i.titulo.match(/\b(casa|apartamento|lote|loja|galp[aã]o|duplex|terreno|sala|kitnet|ponto)\b/i);
  return m ? m[1][0].toUpperCase() + m[1].slice(1).toLowerCase() : 'Imóvel';
}

export function tituloBonito(i: Imovel) {
  const t = i.titulo.trim();
  if (t === t.toUpperCase()) {
    const tipo = tipoDe(i);
    const onde = i.bairro ? ` em ${i.bairro}` : '';
    return i.quartos ? `${tipo} de ${i.quartos} ${i.quartos === 1 ? 'quarto' : 'quartos'}${onde}` : `${tipo}${onde}`;
  }
  return t.replace(/\s+/g, ' ');
}

// Texto alternativo quando o painel não tem: tipo + bairro + número da foto
export const altFoto = (i: Imovel, n = 0) => `${i.tipo}${i.bairro ? ` em ${i.bairro}` : ''}, ${i.cidade} — foto ${n + 1}`;

// Destaques da home: os mais recentes com foto, equilibrando finalidades
export function destaques(imoveis: Imovel[], n = 6) {
  // os marcados como destaque no painel vêm primeiro; depois, os mais recentes
  const peso = (i: Imovel) => (i.destaque ? '1' : '0') + i.modificado;
  const porFin = (f: Finalidade) => imoveis.filter((i) => i.finalidade === f && i.capa).sort((a, b) => peso(b).localeCompare(peso(a)));
  const listas = [porFin('venda'), porFin('temporada'), porFin('anual')];
  const out: Imovel[] = [];
  const fotos = new Set<string>();
  const idx = [0, 0, 0];
  // um de cada finalidade por vez, sem repetir o mesmo imóvel cadastrado em duas finalidades
  for (let volta = 0; out.length < n && volta < 200; volta++) {
    const k = volta % 3, l = listas[k];
    while (idx[k] < l.length && fotos.has(l[idx[k]].capa!.src)) idx[k]++;
    const i = l[idx[k]++];
    if (i) { fotos.add(i.capa!.src); out.push(i); }
  }
  return out;
}

export const contagem = (imoveis: Imovel[], f: Finalidade) => imoveis.filter((i) => i.finalidade === f).length;
