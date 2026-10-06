// ScrollDirector: transforma a rolagem em "progresso de cena" (s) e s em estado.
// s = soma das transições de cada seção [data-cena]; tudo é reversível por construção.
// A abertura (4 atos) é guiada pelo tempo; rolar durante ela acelera até o fim.
import gsap from 'gsap';
import { CENAS, abertura, formasAbertura, type Estado, type Moldura } from './cenas';
import type { Engine } from './Engine';

type Secao = { nome: string; el: HTMLElement; top: number };

export class ScrollDirector {
  secoes: Secao[] = [];
  intro = { t: 1 };
  sMax = 0;
  override: number | null = null; // ?debug: scrubber manual
  moldura: Moldura | null = null; // páginas internas: onde o sol cabe na faixa
  private tweenIntro: gsap.core.Tween | null = null;
  private io: IntersectionObserver | null = null;

  constructor(private engine: Engine) {
    engine.fonte = this;
    addEventListener('resize', () => this.medir());
  }

  montar() {
    this.secoes = [...document.querySelectorAll<HTMLElement>('[data-cena]')].map((el) => ({ nome: el.dataset.cena!, el, top: 0 }));
    this.medir();
    // fontes e imagens mudam a altura das seções depois do primeiro layout
    document.fonts?.ready.then(() => this.medir());
    setTimeout(() => this.medir(), 1200);

    const temHero = this.secoes[0]?.nome === 'hero';
    if (temHero && !sessionStorageGet('am-intro') && !location.search.includes('poster')) {
      this.intro.t = 0;
      this.tweenIntro = gsap.to(this.intro, { t: 1, duration: 5.6, ease: 'none', delay: 0.15, onComplete: () => sessionStorageSet('am-intro', '1') });
      addEventListener('scroll', this.acelerarIntro, { passive: true, once: true });
    } else this.intro.t = 1;

    // páginas internas: pausa o render quando a faixa com a cena sai da tela
    const faixa = document.querySelector<HTMLElement>('[data-cena-faixa]');
    this.io?.disconnect();
    if (faixa) {
      this.io = new IntersectionObserver(([en]) => this.engine.pausar(!en.isIntersecting), { rootMargin: '80px' });
      this.io.observe(faixa);
    } else this.engine.pausar(false);
  }

  desmontar() {
    this.tweenIntro?.progress(1).kill();
    this.io?.disconnect();
    removeEventListener('scroll', this.acelerarIntro);
  }

  private acelerarIntro = () => this.tweenIntro?.timeScale(4);

  medir() {
    const y = scrollY;
    for (const s of this.secoes) s.top = s.el.getBoundingClientRect().top + y;
    this.sMax = Math.max(0, this.secoes.length - 1);
    this.moldura = this.medirMoldura();
  }

  // Espaço livre da faixa com a página no topo (o canvas é fixo: o sol fica parado e a faixa sobe por cima ao rolar)
  private medirMoldura(): Moldura | null {
    const faixa = document.querySelector<HTMLElement>('[data-cena-faixa]');
    const wrap = faixa?.querySelector<HTMLElement>('.wrap');
    if (!faixa || !wrap) return null;
    const W = innerWidth, H = innerHeight, y0 = scrollY;
    const topo = document.querySelector('.topo')?.getBoundingClientRect().height ?? 70;
    const fundo = Math.min(H, faixa.getBoundingClientRect().bottom + y0);
    let x: number, cy: number, r: number;
    if (W >= 900 || W / H >= 1.15) {
      // ao lado do texto (o título ocupa até ~16ch à esquerda)
      const wr = wrap.getBoundingClientRect();
      x = wr.left + wr.width * 0.78;
      cy = (topo + fundo) / 2;
      r = Math.min((fundo - topo) * 0.27, W * 0.11);
    } else {
      // celular em pé: entre o cabeçalho e o começo do texto
      const texto = Math.min(fundo, (wrap.firstElementChild?.getBoundingClientRect().top ?? fundo) + y0);
      x = W / 2;
      cy = (topo + texto) / 2;
      r = Math.min((texto - topo) * 0.34, W * 0.28);
    }
    return { x: (2 * x) / W - 1, y: 1 - (2 * cy) / H, r: Math.max(r, 24) / (H / 2) };
  }

  progresso() {
    if (this.override !== null) return this.override;
    const vh = innerHeight, y = scrollY;
    let s = 0;
    for (let i = 1; i < this.secoes.length; i++) {
      const top = this.secoes[i].top - y;
      s += Math.min(1, Math.max(0, (vh * 0.92 - top) / (vh * 0.62)));
    }
    return s;
  }

  private estadoDe(i: number): Estado {
    const sec = this.secoes[Math.min(i, this.secoes.length - 1)];
    if (!sec) return CENAS.interna;
    if (sec.nome === 'hero' && this.intro.t < 1) return abertura(this.intro.t);
    return CENAS[sec.nome] || CENAS.interna;
  }

  avaliar() {
    const s = this.progresso();
    const i = Math.floor(s), f = s - i;
    const k = f * f * (3 - 2 * f);
    const A = this.estadoDe(i), B = this.estadoDe(i + 1);
    const estado = lerpEstado(A, B, k);
    let formas: [number, number, number];
    if (i === 0 && this.secoes[0]?.nome === 'hero' && this.intro.t < 1) {
      const [a, b, m] = formasAbertura(this.intro.t);
      formas = k > 0 ? [b, B.forma, k] : [a, b, m];
    } else formas = [A.forma, B.forma, k];
    return { estado, formas, moldura: this.moldura };
  }
}

function lerpEstado(a: Estado, b: Estado, k: number): Estado {
  const out: any = {};
  for (const chave of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const va = (a as any)[chave] ?? 0, vb = (b as any)[chave] ?? 0;
    out[chave] = Array.isArray(va) ? va.map((x: number, i: number) => x + (vb[i] - x) * k) : chave === 'forma' ? (k < 0.5 ? va : vb) : va + (vb - va) * k;
  }
  return out;
}

// sessionStorage pode lançar exceção (modo privado, iframe)
function sessionStorageGet(k: string) { try { return sessionStorage.getItem(k); } catch { return null; } }
function sessionStorageSet(k: string, v: string) { try { sessionStorage.setItem(k, v); } catch { /* sem persistência */ } }
