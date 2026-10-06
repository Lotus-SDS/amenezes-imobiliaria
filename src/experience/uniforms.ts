// Uniforms compartilhados entre todos os materiais da cena.
// O Engine copia o "estado da cena" (knobs) para cá a cada quadro.
import { Color, Vector3 } from 'three/webgpu';
import { uniform } from 'three/tsl';

export const U = {
  tempo: uniform(0),
  // céu (interpolado na CPU a partir de brand.experiencia.ceu)
  zenite: uniform(new Color('#02041A')),
  horizonte: uniform(new Color('#0E1850')),
  brilho: uniform(new Color('#3B3F9E')),
  estrelas: uniform(1),
  nuvens: uniform(0.4),
  marProfundo: uniform(new Color('#01030F')),
  // o Sol (símbolo)
  solPos: uniform(new Vector3(3, 3.4, -6)),
  solRaio: uniform(2.2),
  solBrilho: uniform(1), // luz interna do núcleo
  materializar: uniform(0), // 0 = só partículas · 1 = ouro sólido
  gravar: uniform(0), // relevo do "1957"
  gravarBrilho: uniform(0), // brilho dentro da gravação (Ato 3)
  liquido: uniform(1), // amplitude da deformação viva
  irid: uniform(0.38), // iridescência de filme fino
  // partículas
  pAlpha: uniform(1),
  pTamanho: uniform(1),
  pBrilho: uniform(1),
  dia: uniform(0), // 0 noite/crepúsculo · 1 meio-dia // menor de dia: luz aditiva sobre céu claro vira névoa
  ponteiro: uniform(new Vector3(0, 0, -999)), // cursor em coordenadas de mundo
  ponteiroForca: uniform(0),
};
