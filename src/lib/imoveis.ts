// Acesso aos dados dos imóveis (gerados por `npm run sync`) + formatação.
import dados from '../data/imoveis.json';
import tax from '../data/taxonomias.json';
import { brand, waLink } from '../../brand.config';

export type Foto = { full: string; src: string };
export type Imovel = (typeof dados)[number] & { fotos: Foto[] };

export const imoveis = dados as Imovel[];
export const taxonomias = tax;

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

export const temFinanciamento = (i: Imovel) => /financ/i.test(i.descricaoHtml);

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
export function destaques(n = 6) {
  const porFin = (f: Finalidade) => imoveis.filter((i) => i.finalidade === f && i.capa).sort((a, b) => b.modificado.localeCompare(a.modificado));
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

// JSON enxuto para a busca no cliente
export function indiceBusca() {
  return imoveis.map((i) => ({
    u: i.url, c: i.codigo, t: tituloBonito(i), f: i.finalidade, tp: i.tipo, b: i.bairro, q: i.quartos, a: i.area,
    p: i.finalidade === 'venda' ? i.preco : i.finalidade === 'anual' ? i.aluguel : null,
    img: i.capa?.src || '', fin: temFinanciamento(i) ? 1 : 0, s: specs(i).slice(0, 3).join(' · '),
  }));
}

export const contagem = (f: Finalidade) => imoveis.filter((i) => i.finalidade === f).length;
