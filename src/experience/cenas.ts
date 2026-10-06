// Estados de cena ("knobs"). O ScrollDirector interpola entre eles conforme a rolagem;
// o Engine suaviza com mola e copia para os uniforms.
import { FORMA } from './shapes/formas';

export type Estado = {
  hora: number; // 0 noite · .25 amanhecer · .5 dia · .75 pôr do sol · 1 noite
  sol: [number, number, number];
  escala: number;
  materializar: number;
  gravar: number;
  gravarBrilho: number;
  forma: number;
  pAlpha: number;
  pTamanho: number;
  cam: [number, number, number];
  alvo: [number, number, number];
  liquido: number;
  nuvens: number;
  topo?: number; // no celular em pé, quanto o sol sobe a mais (páginas internas: o texto ocupa o meio)
};

const base: Estado = {
  hora: 0.24, sol: [3.4, 3.1, -4], escala: 2.0, materializar: 1, gravar: 1, gravarBrilho: 0.12, forma: FORMA.SOL,
  pAlpha: 0, pTamanho: 1, cam: [0, 1.7, 12], alvo: [0.6, 2.5, -20], liquido: 1, nuvens: 0.55,
};
const e = (o: Partial<Estado>): Estado => ({ ...base, ...o });

// Partículas formando uma silhueta (o sol se desfaz nelas)
const silhueta = (forma: number, hora: number, o: Partial<Estado> = {}) =>
  e({ forma, hora, materializar: 0, gravar: 0, pAlpha: 1, pTamanho: 1.45, sol: [3.6, 2.9, -3.5], escala: 1.9, ...o });

export const CENAS: Record<string, Estado> = {
  // Home
  hero: base,
  comprar: silhueta(FORMA.CASA, 0.27),
  alugar: silhueta(FORMA.APTO, 0.47, { nuvens: 0.35, pTamanho: 1.5 }),
  temporada: e({ hora: 0.73, sol: [2.6, 2.2, -5], escala: 2.3, gravarBrilho: 0.05, nuvens: 0.8 }),
  destaques: e({ hora: 0.78, sol: [4.6, 1.5, -6], escala: 1.7, gravar: 0.6, nuvens: 0.7, alvo: [0.6, 2.2, -20] }),
  lote: silhueta(FORMA.LOTE, 0.8, { nuvens: 0.6 }),
  financiamento: silhueta(FORMA.FATIAS, 0.82, { pTamanho: 1.3, nuvens: 0.6 }),
  comercial: silhueta(FORMA.GALPAO, 0.84, { nuvens: 0.5 }),
  sobre1957: e({ hora: 0.22, sol: [1.6, 1.3, -6], escala: 1.5, gravarBrilho: 0.9, cam: [-0.4, 1.5, 12], alvo: [0.4, 2.2, -20] }),
  sobreLoteamentos: e({ hora: 0.47, sol: [3.4, 4.6, -7], escala: 1.7, cam: [0, 1.9, 12.5], alvo: [0, 2.9, -20], nuvens: 0.35 }),
  sobreHoje: e({ hora: 0.72, sol: [5.0, 1.9, -5], escala: 1.9, cam: [0.6, 1.6, 12], alvo: [1, 2.3, -20] }),
  provas: e({ hora: 0.9, sol: [3.6, 1.3, -6], escala: 1.8, gravar: 1, gravarBrilho: 0.35, nuvens: 0.4 }),
  captacao: silhueta(FORMA.CASA, 0.94, { pTamanho: 1.25 }),
  contato: e({ hora: 1.0, forma: FORMA.ORLA, materializar: 0, gravar: 0, pAlpha: 1, pTamanho: 1, cam: [0, 1.35, 12.5], alvo: [3, 1.6, -20], nuvens: 0.3 }),

  // Páginas internas (só a faixa do topo mostra a cena)
  interna: e({ hora: 0.78, sol: [4.2, 2.3, -5], escala: 1.6, nuvens: 0.7, topo: 3.2 }),
  'interna-venda': e({ hora: 0.26, sol: [4.2, 2.3, -5], escala: 1.6, topo: 3.2 }),
  'interna-anual': e({ hora: 0.46, sol: [4.2, 2.9, -5], escala: 1.6, nuvens: 0.35, topo: 2.8 }),
  'interna-temporada': e({ hora: 0.74, sol: [4.2, 1.9, -5], escala: 1.7, nuvens: 0.8, topo: 3.5 }),
  'interna-noite': e({ hora: 0.98, forma: FORMA.ORLA, materializar: 0, gravar: 0, pAlpha: 1, cam: [0, 1.35, 12.5], alvo: [-4, 1.6, -20] }),
};

// Os 4 atos da abertura, em função de t ∈ [0,1]
export function abertura(t: number): Estado {
  const k = (a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const suave = (x: number) => x * x * (3 - 2 * x);
  const ato4 = suave(k(0.78, 1.0));
  const est = e({
    hora: 0.0 + ato4 * base.hora,
    materializar: suave(k(0.6, 0.8)),
    gravar: suave(k(0.66, 0.84)),
    gravarBrilho: Math.sin(k(0.66, 1.0) * Math.PI) * 1.1 + ato4 * base.gravarBrilho,
    pAlpha: 1 - suave(k(0.74, 0.92)),
    pTamanho: 1,
    cam: [0, 1.25 + suave(k(0.25, 0.85)) * 0.45, 12.6 - suave(k(0.25, 0.9)) * 0.6],
    alvo: [-1.5 + suave(k(0.2, 0.8)) * 2.1, 1.4 + suave(k(0.2, 0.85)) * 1.1, -20],
    liquido: 1,
  });
  return est;
}

// Partículas na abertura: ORLA → ESPIRAL → SOL
export function formasAbertura(t: number): [number, number, number] {
  if (t < 0.28) return [FORMA.ORLA, FORMA.ORLA, 0];
  if (t < 0.5) return [FORMA.ORLA, FORMA.ESPIRAL, (t - 0.28) / 0.22];
  if (t < 0.7) return [FORMA.ESPIRAL, FORMA.SOL, (t - 0.5) / 0.2];
  return [FORMA.SOL, FORMA.SOL, 1];
}

// Páginas internas: a cena só aparece na faixa do topo. O ScrollDirector mede o espaço livre da faixa
// (à direita do texto ou, no celular, entre o cabeçalho e o texto) e o sol é posto ali.
export type Moldura = { x: number; y: number; r: number }; // centro em NDC (-1..1) · raio em frações da meia-altura

export function moldar(est: Estado, m: Moldura | null, fov: number, aspect: number): Estado {
  if (!m || est.forma === FORMA.ORLA) return est; // a orla fica em coordenadas de mundo
  const [cx, cy, cz] = est.cam;
  let fx = est.alvo[0] - cx, fy = est.alvo[1] - cy, fz = est.alvo[2] - cz;
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  // direita = frente × (0,1,0); cima = direita × frente (mesma base do camera.lookAt)
  const rl = Math.hypot(fz, fx), rx = -fz / rl, rz = fx / rl;
  const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
  // mantém a profundidade original do sol; só muda onde ele cai na tela e o tamanho
  const d = (est.sol[0] - cx) * fx + (est.sol[1] - cy) * fy + (est.sol[2] - cz) * fz;
  const t = Math.tan((fov * Math.PI) / 360) * d;
  const sx = m.x * t * aspect, sy = m.y * t;
  return {
    ...est,
    sol: [cx + fx * d + rx * sx + ux * sy, cy + fy * d + uy * sy, cz + fz * d + rz * sx + uz * sy],
    escala: m.r * t,
  };
}

// Ajuste de enquadramento por proporção de tela (celular em pé: sol em cima, centralizado)
export function enquadrar(est: Estado, aspect: number): Estado {
  if (aspect >= 1.15) return est;
  const t = Math.min(1, Math.max(0, (1.15 - aspect) / 0.6));
  const lerp = (a: number, b: number) => a + (b - a) * t;
  return {
    ...est,
    sol: [lerp(est.sol[0], est.sol[0] * 0.08), lerp(est.sol[1], est.sol[1] + 1.9 + (est.topo ?? 0)), est.sol[2]],
    escala: lerp(est.escala, est.escala * (est.topo ? 0.5 : 0.68)),
    cam: [lerp(est.cam[0], 0), est.cam[1], lerp(est.cam[2], est.cam[2] + 2.5)],
    alvo: [lerp(est.alvo[0], est.alvo[0] * 0.2), lerp(est.alvo[1], est.alvo[1] + 0.9), est.alvo[2]],
  };
}
