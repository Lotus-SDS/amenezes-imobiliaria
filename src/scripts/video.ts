// Modo vídeo (aparelho fraco): no lugar do 3D ao vivo, a cena gravada por scripts/gravar-video.mjs.
// O arquivo tem a abertura (VIDEO_INTRO s) seguida da cena da home, 2 s por seção; a rolagem escolhe o quadro.
// Páginas internas ficam com o pôster (o sol delas depende do layout de cada tela).
import gsap from 'gsap';
import { progressoDe } from '../experience/progresso';

// Precisam bater com scripts/gravar-video.mjs
const FPS = 48;
const VIDEO_INTRO = 270 / FPS; // a abertura de 5,6 s do 3D
const POR_SECAO = 96 / FPS; // segundos de vídeo por seção

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const html = document.documentElement;
let video: HTMLVideoElement | null = null;
let tops: number[] = [];
let ativo = false;
let tocandoIntro = false;
let mostrado = -1; // tempo exibido: persegue o da rolagem passando pelos quadros do meio, sem saltos

export function montarVideo() {
  if (!document.querySelector('[data-cena="hero"]')) return pararVideo();
  if (!video) criar();
  ativo = true;
  medir();
  document.fonts?.ready.then(medir);
  setTimeout(medir, 1200);
  if (video!.readyState >= 2) html.classList.add('video-pronto');

  if (!tocandoIntro && !lerSessao('am-intro') && scrollY < 10) {
    tocandoIntro = true;
    video!.currentTime = 0;
    video!.playbackRate = 1;
    video!.play().catch(() => { tocandoIntro = false; });
    addEventListener('scroll', acelerarIntro, { passive: true, once: true });
  }
}

function pararVideo() {
  ativo = false;
  tocandoIntro = false;
  video?.pause();
  html.classList.remove('video-pronto');
}

function criar() {
  const v = (video = document.createElement('video'));
  v.className = 'cena-video';
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  v.setAttribute('aria-hidden', 'true');
  v.src = `${BASE}/video/cena-${innerWidth >= innerHeight ? 'h' : 'v'}.mp4`;
  // o pôster fica por baixo até o primeiro quadro; se o vídeo falhar, ele simplesmente fica
  v.addEventListener('loadeddata', () => ativo && html.classList.add('video-pronto'));
  document.querySelector('.poster')!.append(v);
  addEventListener('resize', medir);
  gsap.ticker.add(atualizar);
}

function medir() {
  tops = [...document.querySelectorAll<HTMLElement>('[data-cena]')].map((el) => el.getBoundingClientRect().top + scrollY);
}

const acelerarIntro = () => { if (video) video.playbackRate = 4; };

function atualizar() {
  const v = video;
  if (!v || !ativo || v.readyState < 1) return;
  if (tocandoIntro) {
    if (v.currentTime < VIDEO_INTRO - 0.03 && !v.ended) return;
    v.pause();
    tocandoIntro = false;
    gravarSessao('am-intro', '1');
  }
  const alvo = Math.min(VIDEO_INTRO + progressoDe(tops) * POR_SECAO, (v.duration || Infinity) - 0.01);
  if (mostrado < 0) mostrado = v.currentTime;
  mostrado += (alvo - mostrado) * 0.18;
  if (!v.seeking && Math.abs(v.currentTime - mostrado) > 0.5 / FPS) v.currentTime = mostrado;
}

// sessionStorage pode lançar exceção (modo privado, iframe)
function lerSessao(k: string) { try { return sessionStorage.getItem(k); } catch { return null; } }
function gravarSessao(k: string, v: string) { try { sessionStorage.setItem(k, v); } catch { /* sem persistência */ } }
