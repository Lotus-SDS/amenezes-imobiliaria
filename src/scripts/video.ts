// Modo vídeo (aparelho fraco): no lugar do 3D ao vivo, a cena gravada por scripts/gravar-video.mjs.
// Três camadas, de baixo para cima:
//   cena-{h,v}.mp4     720p, 2 s por seção da home; a rolagem escolhe o quadro (as formas)
//   hero-{h,v}.webp    Full HD, o sol parado no fim da abertura; some no começo da rolagem
//   abertura-{h,v}.mp4 Full HD, toca uma vez por visita e termina exatamente no quadro do hero
// Páginas internas ficam com o pôster (o sol delas depende do layout de cada tela).
import gsap from 'gsap';
import { progressoDe } from '../experience/progresso';

// Precisam bater com scripts/gravar-video.mjs
const FPS = 48;
const POR_SECAO = 96 / FPS; // segundos de vídeo por seção

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const html = document.documentElement;
let cena: HTMLVideoElement | null = null;
let hero: HTMLImageElement | null = null;
let abertura: HTMLVideoElement | null = null;
let formato: 'h' | 'v' = 'h';
let tops: number[] = [];
let ativo = false;
let mostrado = -1; // tempo exibido: persegue o da rolagem passando pelos quadros do meio, sem saltos
let opacHero = -1;

export function montarVideo() {
  if (!document.querySelector('[data-cena="hero"]')) return pararVideo();
  if (!cena) criar();
  ativo = true;
  medir();
  document.fonts?.ready.then(medir);
  setTimeout(medir, 1200);
  if (cena!.readyState >= 2) html.classList.add('video-pronto');
  if (!abertura && !lerSessao('am-intro') && scrollY < 10) tocarAbertura();
}

function pararVideo() {
  ativo = false;
  cena?.pause();
  encerrarAbertura();
  html.classList.remove('video-pronto');
  definirHero(0);
}

function novoVideo(classe: string, src: string) {
  const v = document.createElement('video');
  v.className = classe;
  v.muted = true;
  v.playsInline = true;
  v.setAttribute('aria-hidden', 'true');
  v.src = src;
  return v;
}

function criar() {
  formato = innerWidth >= innerHeight ? 'h' : 'v';
  const v = (cena = novoVideo('cena-video', `${BASE}/video/cena-${formato}.mp4`));
  // só baixa depois da abertura (ou na primeira rolagem): não disputa banda com ela
  v.preload = 'none';
  // o pôster fica por baixo até o primeiro quadro; se o vídeo falhar, ele simplesmente fica
  const mostrar = () => ativo && html.classList.add('video-pronto');
  v.addEventListener('loadeddata', mostrar);
  v.addEventListener('seeked', mostrar);
  // iOS (e modo de pouca energia): sem um play() o vídeo não carrega nem desenha quadros ao buscar.
  // Destrava no primeiro toque ou rolagem: toca e pausa na hora.
  const destravar = () => {
    removeEventListener('touchstart', destravar);
    removeEventListener('scroll', destravar);
    carregarCena();
    v.play().then(() => v.pause()).catch(() => {});
  };
  addEventListener('touchstart', destravar, { passive: true });
  addEventListener('scroll', destravar, { passive: true });

  const img = (hero = new Image());
  img.className = 'cena-hero';
  img.alt = '';
  img.decoding = 'async';
  img.src = `${BASE}/video/hero-${formato}.webp`;

  document.querySelector('.poster')!.append(v, img);
  addEventListener('resize', medir);
  gsap.ticker.add(atualizar);
}

function carregarCena() {
  if (!cena || cena.preload !== 'none') return;
  cena.preload = 'auto';
  cena.load(); // o iOS ignora preload: pede o arquivo explicitamente
}

function tocarAbertura() {
  const a = (abertura = novoVideo('cena-abertura', `${BASE}/video/abertura-${formato}.mp4`));
  a.preload = 'auto';
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
  carregarCena();
  // o quadro final é o mesmo do hero: a abertura some por cima da imagem, sem salto
  setTimeout(() => a.remove(), 900);
}

const acelerarAbertura = () => { if (abertura) abertura.playbackRate = 4; };

function medir() {
  tops = [...document.querySelectorAll<HTMLElement>('[data-cena]')].map((el) => el.getBoundingClientRect().top + scrollY);
}

function definirHero(o: number) {
  if (!hero || o === opacHero) return;
  opacHero = o;
  hero.style.opacity = String(o);
}

function atualizar() {
  const v = cena;
  if (!v || !ativo) return;
  const s = progressoDe(tops);
  // o sol Full HD espera a abertura acabar (não revela o final) e fica até o primeiro terço da rolagem
  const naAbertura = abertura && !abertura.classList.contains('fim');
  definirHero(naAbertura ? 0 : Math.round(Math.max(0, 1 - s / 0.35) * 100) / 100);
  if (v.readyState < 1) return;
  const alvo = Math.min(s * POR_SECAO, (v.duration || Infinity) - 0.01);
  if (mostrado < 0) mostrado = v.currentTime;
  mostrado += (alvo - mostrado) * 0.18;
  if (!v.seeking && Math.abs(v.currentTime - mostrado) > 0.5 / FPS) v.currentTime = mostrado;
}

// sessionStorage pode lançar exceção (modo privado, iframe)
function lerSessao(k: string) { try { return sessionStorage.getItem(k); } catch { return null; } }
function gravarSessao(k: string, v: string) { try { sessionStorage.setItem(k, v); } catch { /* sem persistência */ } }
