// Geometria da orla de Marataízes (estilizada) — compartilhada entre a silhueta e as luzes.
// A baía recua da esquerda (perto) para a direita (longe); o mar aberto fica à direita, onde o sol nasce.
import taxonomias from '../../data/taxonomias.json';

export const ORLA_X0 = -125;
export const ORLA_X1 = 48;

const frac = (v: number) => v - Math.floor(v);
const h1 = (i: number) => frac(Math.sin(i * 127.1 + 311.7) * 43758.5453);

export const orlaZ = (x: number) => -58 - (x - ORLA_X0) * 0.24 - Math.sin((x - ORLA_X0) * 0.025) * 5;

// Altura dos prédios: centro da cidade mais alto, alguns edifícios de destaque
export const alturaPredio = (x: number) => {
  const i = Math.floor(x / 1.6);
  const r = h1(i);
  const centro = Math.exp(-((x + 55) ** 2) / (2 * 28 ** 2)) * 1.8;
  const destaque = r > 0.93 ? 1.6 + h1(i + 7) * 1.4 : 0;
  return 0.35 + r * 0.9 + centro * (0.5 + r) + destaque;
};

// Bairros reais em ordem aproximada ao longo da costa (norte → sul), com peso pela contagem de imóveis
const ORDEM = ['Barra do Itapemirim', 'Barra', 'Itaipava', 'Centro', 'Cidade Nova', 'Santa Tereza', 'Belo Horizonte',
  'Ilmenita', 'Areias Negras', 'Arraias', 'Recreio Atlântico', 'Santa Helena', 'Acapulco', 'Praia dos Cações',
  'Maraguá', 'Marobá', 'Lagoa Dantas', 'Lagoa Do Siri', 'Ponta Do Siri'];

export function bairrosNaOrla() {
  const cont = Object.fromEntries((taxonomias.bairros as { name: string; count: number }[]).map((b) => [b.name, b.count]));
  const lista = ORDEM.map((n) => ({ nome: n, peso: Math.max(cont[n] || 0, 1) }));
  const n = lista.length;
  return lista.map((b, i) => ({ ...b, x: ORLA_X0 + 8 + (i / (n - 1)) * (ORLA_X1 - ORLA_X0 - 16) }));
}
