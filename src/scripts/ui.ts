// Camada de interface (roda em todos os aparelhos, com ou sem 3D):
// rolagem suave, revelações, cabeçalho, menu, cursor, botões magnéticos, LGPD, formulários e WhatsApp.
// A experiência 3D é carregada depois do `load`, em ocioso, num chunk separado.
import gsap from 'gsap';
import Lenis from 'lenis';
import type { Experiencia } from '../experience/index';
import { detectarModo } from '../experience/QualityManager';

const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fino = matchMedia('(pointer: fine)').matches;
let lenis: Lenis | null = null;
let exp: Experiencia | null = null;
let iniciado = false;
let estadoTier = '';

// Medição (só depois do consentimento). ponytail: IDs fixos aqui; mover para brand.config se houver mais de um.
const PIXEL_META = '2055688301851019';
const GTM = ''; // [PREENCHER: ID do Google Tag Manager]
// Endpoint dos formulários: os contatos caem no painel (/admin/leads/)
const ENDPOINT_LEAD = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api/leads/`;

export function iniciarUI() {
  if (iniciado) return;
  iniciado = true;
  // ?poster: só a cena, sem interface (usado para gerar o pôster estático e a imagem de compartilhamento)
  if (location.search.includes('poster')) document.documentElement.classList.add('modo-poster');

  if (!reduzido) {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true, touchMultiplier: 1.4 });
    gsap.ticker.add((t) => lenis!.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  cabecalho();
  cursor();
  cookies();
  som();
  document.addEventListener('astro:page-load', aoCarregarPagina);
  document.addEventListener('astro:before-swap', () => {
    exp?.director.desmontar();
    observador?.disconnect();
    document.documentElement.classList.remove('menu-aberto');
  });
  document.addEventListener('astro:after-swap', () => {
    // o roteador troca os atributos do <html> pelos da página nova: reaplica o estado da experiência
    const html = document.documentElement;
    html.classList.add('js');
    if (exp) html.classList.add('cena-pronta');
    if (estadoTier) html.dataset.tier = estadoTier;
    if (estadoTier === 'estatico') html.classList.add('sem-cena');
    lenis?.scrollTo(0, { immediate: true });
  });

  // 3D: depois do load, em ocioso (nunca disputa com o conteúdo)
  const carregar = () => (window.requestIdleCallback || ((f: any) => setTimeout(f, 300)))(iniciar3D, { timeout: 2500 } as any);
  if (document.readyState === 'complete') carregar();
  else addEventListener('load', carregar, { once: true });
}

async function iniciar3D() {
  const canvas = document.getElementById('cena') as HTMLCanvasElement | null;
  if (!canvas) return;
  // detecta o aparelho ANTES de baixar o 3D: quem vai ver a versão estática nunca paga o custo do chunk
  const modo = detectarModo();
  document.documentElement.dataset.tier = estadoTier = modo;
  if (modo === 'estatico') return revelarSemCena();
  try {
    const { iniciarExperiencia } = await import('../experience/index');
    exp = await iniciarExperiencia(canvas, modo);
    if (!exp) return revelarSemCena();
    document.documentElement.classList.add('cena-pronta');
    canvas.addEventListener('experiencia:falha', () => {
      document.documentElement.classList.remove('cena-pronta');
      exp?.engine.dispose();
      exp = null;
    });
  } catch (e) {
    console.warn('[A.Menezes] experiência 3D indisponível, seguindo com a versão estática.', e);
    revelarSemCena();
  }
}

// Sem 3D: a abertura não acontece, então o título aparece direto
function revelarSemCena() {
  document.documentElement.classList.add('sem-cena');
}

function aoCarregarPagina() {
  document.documentElement.classList.remove('menu-aberto');
  if (exp) exp.director.montar();

  revelacoes();
  contadores();
  magneticos();
  formularios();
  whatsapp();
  buscaCodigo();
}

// Revelações e contadores com IntersectionObserver nativo (zero leitura de layout no scroll)
let observador: IntersectionObserver | null = null;

function revelacoes() {
  const els = [...document.querySelectorAll<HTMLElement>('[data-revelar]')];
  if (reduzido) return els.forEach((el) => el.classList.add('revelado'));
  let fila = 0;
  observador = new IntersectionObserver((entradas) => {
    for (const en of entradas) {
      if (!en.isIntersecting) continue;
      observador!.unobserve(en.target);
      const el = en.target as HTMLElement;
      if (el.dataset.contar) { contar(el); continue; }
      setTimeout(() => el.classList.add('revelado'), (fila++ % 6) * 90);
      setTimeout(() => (fila = 0), 400);
    }
  }, { rootMargin: '0px 0px -12% 0px' });
  els.forEach((el) => observador!.observe(el));
}

function contar(el: HTMLElement) {
  const fim = Number(el.dataset.contar);
  const o = { v: Number(el.dataset.de || 0) };
  gsap.to(o, { v: fim, duration: 2.2, ease: 'power3.out', onUpdate: () => (el.textContent = fmtContador(el, o.v)) });
}

function fmtContador(el: HTMLElement, v: number) {
  return (el.dataset.ano !== undefined ? String(Math.round(v)) : Math.round(v).toLocaleString('pt-BR')) + (el.dataset.sufixo || '');
}

function contadores() {
  document.querySelectorAll<HTMLElement>('[data-contar]').forEach((el) => {
    if (reduzido || !observador) return void (el.textContent = fmtContador(el, Number(el.dataset.contar)));
    el.textContent = fmtContador(el, Number(el.dataset.de || 0));
    observador.observe(el);
  });
}

function cabecalho() {
  const topo = document.querySelector<HTMLElement>('.topo');
  const btn = document.querySelector<HTMLButtonElement>('.menu-btn');
  let ultimo = 0;
  const aoRolar = () => {
    const y = scrollY;
    topo?.classList.toggle('rolou', y > 40);
    const menuAberto = document.documentElement.classList.contains('menu-aberto');
    topo?.classList.toggle('escondido', !menuAberto && y > 400 && y > ultimo + 2);
    if (y < ultimo - 2) topo?.classList.remove('escondido');
    ultimo = y;
  };
  addEventListener('scroll', aoRolar, { passive: true });
  btn?.addEventListener('click', () => {
    const aberto = document.documentElement.classList.toggle('menu-aberto');
    btn.setAttribute('aria-expanded', String(aberto));
    btn.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
    aberto ? lenis?.stop() : lenis?.start();
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.documentElement.classList.contains('menu-aberto')) btn?.click();
  });
  document.addEventListener('astro:after-swap', () => { lenis?.start(); btn?.setAttribute('aria-expanded', 'false'); });
}

function cursor() {
  const c = document.querySelector<HTMLElement>('.cursor');
  if (!c || !fino || reduzido) return;
  const x = gsap.quickTo(c, 'x', { duration: 0.35, ease: 'power3' });
  const y = gsap.quickTo(c, 'y', { duration: 0.35, ease: 'power3' });
  addEventListener('pointermove', (e) => {
    c.classList.add('ativo');
    x(e.clientX); y(e.clientY);
    c.classList.toggle('sobre-link', !!(e.target as HTMLElement).closest('a,button,[data-magnetic],label,select'));
  }, { passive: true });
  document.addEventListener('pointerleave', () => c.classList.remove('ativo'));
}

function magneticos() {
  if (!fino || reduzido) return;
  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
    if (el.dataset.magOk) return;
    el.dataset.magOk = '1';
    const x = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, .45)' });
    const y = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, .45)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      x((e.clientX - r.left - r.width / 2) * 0.28);
      y((e.clientY - r.top - r.height / 2) * 0.35);
    });
    el.addEventListener('pointerleave', () => { x(0); y(0); });
  });
}

// ── LGPD ─────────────────────────────────────────────────
function lerConsent() { try { return localStorage.getItem('am-consent'); } catch { return null; } }
function gravarConsent(v: string) { try { localStorage.setItem('am-consent', v); } catch { /* sem persistência */ } }

function cookies() {
  const banner = document.querySelector<HTMLElement>('.cookies');
  const atual = lerConsent();
  if (atual === 'aceito') carregarMedicao();
  if (!atual && banner) banner.hidden = false;
  banner?.addEventListener('click', (e) => {
    const acao = (e.target as HTMLElement).closest<HTMLElement>('[data-cookies]')?.dataset.cookies;
    if (!acao) return;
    gravarConsent(acao === 'aceitar' ? 'aceito' : 'recusado');
    banner.hidden = true;
    if (acao === 'aceitar') carregarMedicao();
  });
}

function carregarMedicao() {
  // Meta Pixel e GTM só depois do aceite (Consent Mode). No modo local de apresentação, nada é enviado.
  if (location.hostname !== 'amenezes.com.br') return;
  const w = window as any;
  if (PIXEL_META && !w.fbq) {
    const n: any = (w.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); });
    n.queue = []; n.loaded = true; n.version = '2.0';
    const s = document.createElement('script'); s.async = true; s.src = 'https://connect.facebook.net/en_US/fbevents.js'; document.head.append(s);
    w.fbq('init', PIXEL_META); w.fbq('track', 'PageView');
  }
  if (GTM && !w.dataLayer) {
    w.dataLayer = [{ 'gtm.start': Date.now(), event: 'gtm.js' }];
    const s = document.createElement('script'); s.async = true; s.src = `https://www.googletagmanager.com/gtm.js?id=${GTM}`; document.head.append(s);
  }
}

function evento(nome: string, dados: object = {}) {
  const w = window as any;
  w.dataLayer?.push({ event: nome, ...dados });
  w.fbq?.('trackCustom', nome, dados);
}

// ── Conversão ────────────────────────────────────────────
function recompensa() {
  exp?.engine.recompensa();
}

function whatsapp() {
  document.querySelectorAll<HTMLAnchorElement>('[data-wa]').forEach((a) => {
    if (a.dataset.waOk) return;
    a.dataset.waOk = '1';
    a.addEventListener('click', () => { evento('whatsapp_clique', { pagina: location.pathname }); recompensa(); });
  });
}

function formularios() {
  document.querySelectorAll<HTMLFormElement>('form[data-lead]').forEach((f) => {
    if (f.dataset.ok) return;
    f.dataset.ok = '1';
    const inicio = Date.now();
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!f.reportValidity()) return;
      // campos com várias escolhas (checkbox com o mesmo nome) viram lista
      const fd = new FormData(f);
      const dados: Record<string, unknown> = {};
      for (const k of new Set(fd.keys())) { const v = fd.getAll(k).map(String); dados[k] = v.length > 1 ? v : v[0]; }
      if (dados.website || Date.now() - inicio < 2500) return; // honeypot + armadilha de tempo
      const btn = f.querySelector<HTMLButtonElement>('[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }
      try {
        const r = await fetch(ENDPOINT_LEAD, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...dados, formulario: f.dataset.lead, pagina: location.href }) });
        if (!r.ok) throw new Error(String(r.status));
        f.classList.add('enviado');
        evento('lead_enviado', { tipo: f.dataset.lead });
        recompensa();
        f.querySelector<HTMLElement>('.form-ok')?.focus();
      } catch {
        if (btn) { btn.disabled = false; btn.textContent = 'Tentar de novo'; }
        alert('Não conseguimos enviar agora. Fale com a gente pelo WhatsApp, por favor.');
      }
    });
  });
}

function buscaCodigo() {
  document.querySelectorAll<HTMLFormElement>('form[data-busca]').forEach((f) => {
    if (f.dataset.ok) return;
    f.dataset.ok = '1';
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = String(new FormData(f).get('q') || '').trim();
      location.href = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/imoveis/${q ? `?q=${encodeURIComponent(q)}` : ''}`;
    });
  });
}

function som() {
  const b = document.querySelector<HTMLButtonElement>('.som');
  b?.addEventListener('click', () => {
    if (!exp) return;
    const ligado = exp.audio.alternar();
    b.setAttribute('aria-pressed', String(ligado));
  });
}
