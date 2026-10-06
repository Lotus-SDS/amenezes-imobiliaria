// Detecção de tier + benchmark curto + escalonamento dinâmico em tempo real.
// Regra: a experiência nunca pode travar o site. Na dúvida, desce um degrau.
import type { Tier } from '../../brand.config';

export type Modo = Tier | 'estatico';

export function lerGPU(): { webgl2: boolean; renderer: string } {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2', { failIfMajorPerformanceCaveat: true }) as WebGL2RenderingContext | null;
    if (!gl) return { webgl2: false, renderer: '' };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { webgl2: true, renderer: String(r || '') };
  } catch {
    return { webgl2: false, renderer: '' };
  }
}

export function detectarModo(): Modo {
  const q = new URLSearchParams(location.search);
  const forcado = q.get('tier');
  if (forcado === 'alto' || forcado === 'medio' || forcado === 'baixo' || forcado === 'estatico') return forcado;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 'estatico';
  if ((navigator as any).connection?.saveData) return 'estatico';
  const { webgl2, renderer } = lerGPU();
  if (!webgl2 && !('gpu' in navigator)) return 'estatico';

  const r = renderer.toLowerCase();
  const toque = matchMedia('(pointer: coarse)').matches;
  const memoria = (navigator as any).deviceMemory ?? 8;
  const nucleos = navigator.hardwareConcurrency ?? 4;

  if (/swiftshader|llvmpipe|software|basic render/.test(r)) return 'estatico';
  if (/mali-[t4]|adreno \(tm\) [1-4]\d\d|adreno [1-4]\d\d|powervr|sgx|mali-g(31|51|52|57)/.test(r)) return 'baixo';
  if (toque) {
    // celular/tablet: topo de linha vai para médio; o resto, baixo
    if (/apple/.test(r) && memoria >= 4) return 'medio';
    if (/adreno \(tm\) (7[3-9]\d|8\d\d)|adreno (7[3-9]\d|8\d\d)|mali-g7[1-9]|mali-g[6-9]\d\d|xclipse|immortalis/.test(r)) return 'medio';
    return memoria >= 6 && nucleos >= 8 ? 'medio' : 'baixo';
  }
  if (/rtx|radeon rx|geforce gtx (10[6-8]|16)|apple m\d|arc a/.test(r)) return 'alto';
  if (/intel.*(uhd|hd) graphics [1-6]\d\d\b/.test(r) || memoria <= 4) return 'baixo';
  return 'medio';
}

// Escalonamento dinâmico: mede o tempo de quadro e ajusta a resolução; se não bastar, avisa o Engine.
export class QualityManager {
  orcamento: number; // ms por quadro
  escala = 1; // multiplicador do DPR (0.55 – 1)
  private media = 0;
  private acima = 0;
  private abaixo = 0;
  private aquecendo = 40; // ignora os primeiros quadros (compilação, upload)
  onEscala?: (escala: number) => void;
  onCorte?: (nivel: number) => void;
  nivelCorte = 0;

  constructor(public modo: Modo) {
    this.orcamento = modo === 'baixo' ? 1000 / 30 : 1000 / 58;
  }

  amostrar(ms: number) {
    if (this.aquecendo-- > 0) return;
    if (ms > 250) return; // aba voltou do segundo plano
    this.media = this.media ? this.media * 0.92 + ms * 0.08 : ms;
    if (this.media > this.orcamento * 1.18) { this.acima++; this.abaixo = 0; }
    else if (this.media < this.orcamento * 0.72) { this.abaixo++; this.acima = 0; }
    else { this.acima = Math.max(0, this.acima - 1); this.abaixo = Math.max(0, this.abaixo - 1); }

    if (this.acima > 45) {
      // ~0,75 s acima do orçamento → desce
      this.acima = 0;
      if (this.escala > 0.6) { this.escala = Math.max(0.55, this.escala - 0.12); this.onEscala?.(this.escala); }
      else { this.nivelCorte++; this.onCorte?.(this.nivelCorte); }
    } else if (this.abaixo > 300 && this.escala < 1) {
      // ~5 s folgado → sobe
      this.abaixo = 0;
      this.escala = Math.min(1, this.escala + 0.08);
      this.onEscala?.(this.escala);
    }
  }

  get fps() { return this.media ? 1000 / this.media : 0; }
  get msMedio() { return this.media; }
}
