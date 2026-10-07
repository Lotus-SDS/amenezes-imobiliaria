// Detecção de tier + escalonamento dinâmico em tempo real.
// Regra: a experiência nunca pode travar o site. Na dúvida, desce um degrau.
// Aparelho fraco não roda o 3D: vê o vídeo gravado da própria cena (modo 'video').
import type { Tier } from '../../brand.config';

export type Modo = Tier | 'estatico' | 'video';

// Lembra entre visitas que o 3D desistiu neste aparelho
const CHAVE_VIDEO = 'am-modo';
export function lembrarVideo() { try { localStorage.setItem(CHAVE_VIDEO, 'video'); } catch { /* sem persistência */ } }
function lembrouVideo() { try { return localStorage.getItem(CHAVE_VIDEO) === 'video'; } catch { return false; } }

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
  if (forcado === 'alto' || forcado === 'medio' || forcado === 'baixo' || forcado === 'estatico' || forcado === 'video') return forcado;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 'estatico';
  if ((navigator as any).connection?.saveData) return 'estatico';
  if (lembrouVideo()) return 'video';
  // sem WebGL2 "de verdade" (falhou no failIfMajorPerformanceCaveat = renderização por software
  // ou GPU bloqueada): não adianta ter navigator.gpu, a cena rodaria na CPU
  const { webgl2, renderer } = lerGPU();
  const r = renderer.toLowerCase();
  if (!webgl2 || !r || /swiftshader|llvmpipe|software|basic render/.test(r)) return 'video';

  const toque = matchMedia('(pointer: coarse)').matches;
  const memoria = (navigator as any).deviceMemory ?? 8;
  const nucleos = navigator.hardwareConcurrency ?? 4;

  if (/mali-[t4]|adreno \(tm\) [1-4]\d\d|adreno [1-4]\d\d|powervr|sgx|mali-g(31|51|52|57)/.test(r)) return 'video';
  if (toque) {
    // celular/tablet: topo de linha vai para médio; o resto, vídeo
    if (/apple/.test(r) && memoria >= 4) return 'medio';
    if (/adreno \(tm\) (7[3-9]\d|8\d\d)|adreno (7[3-9]\d|8\d\d)|mali-g7[1-9]|mali-g[6-9]\d\d|xclipse|immortalis/.test(r)) return 'medio';
    return memoria >= 6 && nucleos >= 8 ? 'medio' : 'video';
  }
  if (/rtx|radeon rx|geforce gtx (10[6-8]|16)|apple m\d|arc a/.test(r)) return 'alto';
  // vídeo integrado no PC (Intel UHD/Iris, Radeon Graphics/Vega do processador) ou pouca memória
  if ((/intel/.test(r) && !/\barc\b/.test(r)) || /radeon(\(tm\))? (graphics|vega)|\bvega\b/.test(r) || memoria <= 4) return 'video';
  return 'medio';
}

// Escalonamento dinâmico: mede o tempo de quadro e ajusta a resolução; se não bastar, avisa o Engine.
// Tudo medido em tempo (ms), não em quadros: a 4 fps, "45 quadros" seriam mais de 10 s travado.
export class QualityManager {
  orcamento: number; // ms por quadro
  escala = 1; // multiplicador do DPR (0.55 – 1)
  private media = 0;
  private acima = 0; // ms seguidos acima do orçamento
  private abaixo = 0; // ms seguidos com folga
  private lento = 0; // ms seguidos abaixo de ~14 fps
  private aquecendo = 1200; // ignora o começo (compilação, upload)
  onEscala?: (escala: number) => void;
  onCorte?: (nivel: number) => void;
  nivelCorte = 0;

  constructor(public modo: Modo) {
    this.orcamento = modo === 'baixo' ? 1000 / 30 : 1000 / 58;
  }

  amostrar(ms: number) {
    // em segundo plano o laço para (Engine.sincronizarLaco), então quadro longo é lentidão de verdade:
    // limitar em vez de descartar (renderização por software passa de 1 s por quadro)
    ms = Math.min(ms, 1000);
    if ((this.aquecendo -= ms) > 0) return;
    this.media = this.media ? this.media * 0.92 + ms * 0.08 : ms;

    // saída rápida: máquina sem fôlego desiste de uma vez (vai para o vídeo), sem descer degrau por degrau
    this.lento = this.media > 70 ? this.lento + ms : 0;
    if (this.lento > 1500) {
      this.lento = 0;
      this.nivelCorte = 3;
      this.onCorte?.(this.nivelCorte);
      return;
    }

    if (this.media > this.orcamento * 1.18) { this.acima += ms; this.abaixo = 0; }
    else if (this.media < this.orcamento * 0.72) { this.abaixo += ms; this.acima = 0; }
    else { this.acima = Math.max(0, this.acima - ms); this.abaixo = Math.max(0, this.abaixo - ms); }

    if (this.acima > 750) {
      // ~0,75 s acima do orçamento → desce
      this.acima = 0;
      if (this.escala > 0.6) { this.escala = Math.max(0.55, this.escala - 0.12); this.onEscala?.(this.escala); }
      else { this.nivelCorte++; this.onCorte?.(this.nivelCorte); }
    } else if (this.abaixo > 5000 && this.escala < 1) {
      // ~5 s folgado → sobe
      this.abaixo = 0;
      this.escala = Math.min(1, this.escala + 0.08);
      this.onEscala?.(this.escala);
    }
  }

  get fps() { return this.media ? 1000 / this.media : 0; }
  get msMedio() { return this.media; }
}
