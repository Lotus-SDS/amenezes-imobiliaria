// Modo vídeo (aparelho fraco): no lugar do 3D ao vivo, a cena pré-renderizada por scripts/gravar-video.mjs.
//   abertura-{h,v}.mp4  Full HD, toca uma vez por visita e termina exatamente na tela 0 (o sol 1957)
//   tela-{h,v}-{k}.webp Full HD, uma tela fixa por seção da home; a rolagem dissolve uma na seguinte
// Imagem parada não custa nada à máquina e fica nítida (o vídeo seguindo a rolagem era 720p e pesava).
// Páginas internas ficam com o pôster (o sol delas depende do layout de cada tela).
import gsap from 'gsap';
import { progressoDe } from '../experience/progresso';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const html = document.documentElement;
let camada: HTMLElement | null = null;
const telas = new Map<number, HTMLImageElement>();
let abertura: HTMLVideoElement | null = null;
let formato: 'h' | 'v' = 'h';
let tops: number[] = [];
let ativo = false;
let ultimo = '';

export function montarVideo() {
  if (!document.querySelector('[data-cena="hero"]')) return pararVideo();
  if (!camada) criar();
  ativo = true;
  camada!.hidden = false;
  medir();
  document.fonts?.ready.then(medir);
  setTimeout(medir, 1200);
  if (!abertura && !lerSessao('am-intro') && scrollY < 10) tocarAbertura();
}

function pararVideo() {
  ativo = false;
  encerrarAbertura();
  if (camada) camada.hidden = true;
  ultimo = '';
}

function criar() {
  formato = innerWidth >= innerHeight ? 'h' : 'v';
  camada = document.createElement('div');
  camada.className = 'cena-telas';
  document.querySelector('.poster')!.append(camada);
  addEventListener('resize', medir);
  gsap.ticker.add(atualizar);
}

// Só existem no DOM a tela atual, a seguinte e as vizinhas (memória baixa em PC fraco e celular)
function tela(k: number) {
  let img = telas.get(k);
  if (!img) {
    img = new Image();
    img.className = 'cena-tela';
    img.alt = '';
    img.decoding = 'async';
    img.style.zIndex = String(k);
    img.src = `${BASE}/cena/tela-${formato}-${k}.webp`;
    telas.set(k, img);
    camada!.append(img);
  }
  return img;
}

function tocarAbertura() {
  const a = (abertura = document.createElement('video'));
  a.className = 'cena-abertura';
  a.muted = true;
  a.playsInline = true;
  a.preload = 'auto';
  a.setAttribute('aria-hidden', 'true');
  a.src = `${BASE}/cena/abertura-${formato}.mp4`;
  a.addEventListener('playing', () => a.classList.add('tocando'));
  a.addEventListener('ended', encerrarAbertura);
  // internet lenta: se não começar em 2,5 s, pula direto para o sol parado
  const desistir = setTimeout(encerrarAbertura, 2500);
  a.addEventListener('playing', () => clearTimeout(desistir), { once: true });
  addEventListener('scroll', acelerarAbertura, { passive: true, once: true });
  document.querySelector('.poster')!.append(a);
  a.play().catch(encerrarAbertura);
}

function encerrarAbertura() {
  const a = abertura;
  if (!a || a.classList.contains('fim')) return;
  gravarSessao('am-intro', '1');
  removeEventListener('scroll', acelerarAbertura);
  a.classList.add('fim');
  a.pause();
  // o quadro final é a tela 0: a abertura some por cima dela, sem salto
  setTimeout(() => a.remove(), 900);
}

const acelerarAbertura = () => { if (abertura) abertura.playbackRate = 4; };

function medir() {
  tops = [...document.querySelectorAll<HTMLElement>('[data-cena]')].map((el) => el.getBoundingClientRect().top + scrollY);
}

function atualizar() {
  if (!ativo || !tops.length) return;
  // as telas esperam a abertura acabar (não revelam o final antes da hora)
  if (abertura && !abertura.classList.contains('fim')) return;
  const s = Math.min(progressoDe(tops), tops.length - 1);
  const i = Math.floor(s);
  const f = s - i;
  const mistura = Math.round(f * f * (3 - 2 * f) * 100) / 100;
  const estado = `${i}:${mistura}`;
  if (estado === ultimo) return;
  ultimo = estado;

  // carrega uma à frente e uma atrás; descarta as distantes
  for (const k of [i - 1, i, i + 1, i + 2]) if (k >= 0 && k < tops.length) tela(k);
  for (const [k, img] of telas) {
    if (k < i - 1 || k > i + 2) { img.remove(); telas.delete(k); continue; }
    img.style.opacity = k === i ? '1' : k === i + 1 ? String(mistura) : '0';
  }
}

// sessionStorage pode lançar exceção (modo privado, iframe)
function lerSessao(k: string) { try { return sessionStorage.getItem(k); } catch { return null; } }
function gravarSessao(k: string, v: string) { try { sessionStorage.setItem(k, v); } catch { /* sem persistência */ } }
