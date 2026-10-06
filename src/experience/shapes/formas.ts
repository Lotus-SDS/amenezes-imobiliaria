// Estados-alvo das partículas. Cada estado = N pontos vec4 (xyz + tamanho relativo).
// ORLA está em coordenadas de mundo; os demais são locais ao Sol (unidade = raio do Sol).
import { ORLA_X0, ORLA_X1, alturaPredio, bairrosNaOrla, orlaZ } from './orla';

export const FORMA = { ORLA: 0, ESPIRAL: 1, SOL: 2, CASA: 3, APTO: 4, LOTE: 5, GALPAO: 6, FATIAS: 7 } as const;
export const N_FORMAS = 8;

// gerador determinístico (mesma cena em todo aparelho)
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// ── Silhuetas desenhadas em canvas e amostradas por área ─────────────────────
type Desenho = (g: CanvasRenderingContext2D) => void;

const desenhos: Record<'CASA' | 'APTO' | 'LOTE' | 'GALPAO', Desenho> = {
  CASA: (g) => {
    g.lineJoin = 'round';
    g.beginPath(); g.moveTo(28, 128); g.lineTo(128, 40); g.lineTo(228, 128); g.lineWidth = 16; g.stroke(); // telhado
    g.fillRect(170, 52, 22, 46); // chaminé
    g.fillRect(56, 124, 144, 100); // corpo
    g.globalCompositeOperation = 'destination-out';
    g.fillRect(110, 160, 36, 64); // porta
    g.fillRect(72, 146, 26, 26); g.fillRect(158, 146, 26, 26); // janelas
    g.globalCompositeOperation = 'source-over';
  },
  APTO: (g) => {
    g.fillRect(70, 22, 116, 210);
    g.fillRect(40, 96, 40, 136);
    g.globalCompositeOperation = 'destination-out';
    for (let y = 38; y < 200; y += 24) for (let x = 84; x < 176; x += 26) g.fillRect(x, y, 14, 13);
    for (let y = 110; y < 210; y += 24) g.fillRect(50, y, 18, 12);
    g.fillRect(114, 206, 28, 26);
    g.globalCompositeOperation = 'source-over';
  },
  LOTE: (g) => {
    // terreno em perspectiva com marcação + pino de localização
    g.lineWidth = 7;
    g.setLineDash([16, 10]);
    g.beginPath(); g.moveTo(40, 200); g.lineTo(128, 236); g.lineTo(216, 200); g.lineTo(128, 164); g.closePath(); g.stroke();
    g.setLineDash([]);
    g.beginPath(); g.arc(128, 82, 46, Math.PI, 0); g.lineTo(128, 196); g.closePath(); g.fill();
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.arc(128, 82, 18, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'source-over';
  },
  GALPAO: (g) => {
    g.beginPath(); g.moveTo(20, 226); g.lineTo(20, 120); g.quadraticCurveTo(128, 30, 236, 120); g.lineTo(236, 226); g.closePath(); g.fill();
    g.globalCompositeOperation = 'destination-out';
    g.fillRect(84, 136, 88, 90);
    g.globalCompositeOperation = 'source-over';
    for (let y = 144; y < 222; y += 12) g.fillRect(90, y, 76, 5); // porta de enrolar
  },
};

// Silhuetas usam no máximo ~16 mil pontos visíveis em qualquer tier: mais que isso a luz aditiva satura em branco
const VISIVEIS_SILHUETA = 16000;

function amostrarDesenho(d: Desenho, n: number, r: () => number, out: Float32Array, base: number) {
  const passo = Math.max(1, Math.ceil(n / VISIVEIS_SILHUETA));
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.fillStyle = g.strokeStyle = '#fff';
  d(g);
  const px = g.getImageData(0, 0, S, S).data;
  const cheios: number[] = [];
  for (let i = 0; i < S * S; i++) if (px[i * 4 + 3] > 128) cheios.push(i);
  for (let k = 0; k < n; k++) {
    const i = cheios[Math.floor(r() * cheios.length)];
    const x = (i % S) + r(), y = Math.floor(i / S) + r();
    const o = (base + k) * 4;
    out[o] = (x / S - 0.5) * 2.5;
    out[o + 1] = (0.5 - y / S) * 2.5;
    out[o + 2] = (r() - 0.5) * 0.12;
    out[o + 3] = k % passo === 0 ? 0.7 + r() * 0.6 : 0; // os demais ficam no lugar, apagados
  }
}

const ceder = () => new Promise<void>((r) => setTimeout(r, 0));

export async function gerarFormas(N: number): Promise<Float32Array> {
  const out = new Float32Array(N * N_FORMAS * 4);
  const r = rng(1957);
  const put = (forma: number, i: number, x: number, y: number, z: number, w: number) => {
    const o = (forma * N + i) * 4;
    out[o] = x; out[o + 1] = y; out[o + 2] = z; out[o + 3] = w;
  };

  // ORLA (mundo): luzes dos prédios por bairro, postes na beira-mar e reflexos na água
  const bairros = bairrosNaOrla();
  const pesoTotal = bairros.reduce((a, b) => a + b.peso, 0);
  const nPredios = Math.floor(N * 0.3), nPostes = Math.floor(N * 0.06);
  const luzes: [number, number, number][] = [];
  for (let i = 0; i < N; i++) {
    if (i < nPredios) {
      let alvo = r() * pesoTotal, b = bairros[0];
      for (const bb of bairros) { alvo -= bb.peso; if (alvo <= 0) { b = bb; break; } }
      const x = Math.min(ORLA_X1 - 1, Math.max(ORLA_X0 + 1, b.x + (r() + r() + r() - 1.5) * 9));
      const h = alturaPredio(x);
      const y = 0.15 + r() * Math.max(0.1, h - 0.25);
      const z = orlaZ(x) + 0.35;
      luzes.push([x, y, z]);
      put(0, i, x, y, z, 3.2 + r() * 3.5);
    } else if (i < nPredios + nPostes) {
      const t = (i - nPredios) / nPostes;
      const x = ORLA_X0 + t * (ORLA_X1 - ORLA_X0);
      const espaco = Math.floor(t * 260) % 2 === 0;
      put(0, i, x, 0.22, orlaZ(x) + 2.2, espaco ? 4.5 : 0);
    } else {
      // reflexo: coluna vertical sob uma luz, cada vez mais fraca em direção à câmera
      const [lx, ly, lz] = luzes[Math.floor(r() * luzes.length)] || [0, 0.5, -70];
      const d = r() ** 1.6;
      const z = lz + 1.5 + d * (6 + ly * 9);
      put(0, i, lx + (r() - 0.5) * 0.5, 0.03, z, (1 - d) * 2.4 + 0.2);
    }
  }

  await ceder();
  for (let i = 0; i < N; i++) {
    // ESPIRAL: sobe do mar em torno do eixo do Sol
    const t = i / N;
    const ang = t * Math.PI * 22 + r() * 0.4;
    const rad = 0.6 + (1 - t) * 1.9 + r() * 0.25;
    put(1, i, Math.cos(ang) * rad, -1.9 + t * 2.4 + (r() - 0.5) * 0.2, Math.sin(ang) * rad, 0.8 + r() * 0.6);

    // SOL: superfície da esfera, levemente acima
    const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u), rr = 1.01 + r() * 0.04;
    put(2, i, s * Math.cos(a) * rr, u * rr, s * Math.sin(a) * rr, 0.9 + r() * 0.3);

    // FATIAS: disco dividido em 120 partes ("até 120x")
    const fatia = Math.floor(r() * 120);
    const ang2 = ((fatia + 0.12 + r() * 0.76) / 120) * Math.PI * 2;
    const rad2 = 0.42 + Math.sqrt(r()) * 0.88;
    const passo = Math.max(1, Math.ceil(N / VISIVEIS_SILHUETA));
    put(7, i, Math.cos(ang2) * rad2 * 1.15, Math.sin(ang2) * rad2 * 1.15, (r() - 0.5) * 0.06, i % passo === 0 ? 0.8 + r() * 0.5 : 0);
  }

  const nomes = ['CASA', 'APTO', 'LOTE', 'GALPAO'] as const;
  for (let k = 0; k < nomes.length; k++) {
    await ceder();
    amostrarDesenho(desenhos[nomes[k]], N, r, out, (3 + k) * N);
  }
  return out;
}
