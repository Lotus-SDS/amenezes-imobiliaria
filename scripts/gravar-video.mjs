// Pré-renderiza a cena para aparelhos fracos (modo 'video', player em src/scripts/video.ts).
// Uso: com o dev server rodando (npx astro dev --port 4321): `node scripts/gravar-video.mjs [url]`.
// Abre a home com ?poster&debug&gravar&tier=alto no Chrome com GPU, avança a cena quadro a quadro
// (abertura + 2 s de simulação por seção, para as formas se montarem) e gera em public/cena/:
// abertura-{h,v}.mp4 (Full HD) e tela-{h,v}-{k}.webp (Full HD, uma por seção; a 0 é o sol 1957).
// Rode de novo sempre que a cena 3D mudar de aparência.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL_BASE = process.argv[2] ?? 'http://localhost:4321/';
// precisam bater com src/scripts/video.ts
const FPS = 48;
const INTRO = 270; // quadros da abertura (5,6 s)
const POR_SECAO = 96; // quadros de simulação entre uma seção e a seguinte (as formas terminam de se montar)
const FORMATOS = { h: { width: 1920, height: 1080 }, v: { width: 1080, height: 1920 } };

const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--enable-unsafe-webgpu'] });
mkdirSync('public/cena', { recursive: true });

for (const [nome, viewport] of Object.entries(FORMATOS)) {
  const dir = join(tmpdir(), `am-quadros-${nome}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir);

  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.goto(`${URL_BASE}?poster&debug&gravar&tier=alto`);
  await page.waitForFunction(() => window.__am?.engine?.sim, null, { timeout: 120_000 });
  // painel de debug e grão ficam fora: o grão é aplicado ao vivo por cima do vídeo
  await page.addStyleTag({ content: '.lil-gui, .grao { display: none !important; } html { scrollbar-width: none; }' });

  const passo = (intro, s) => page.evaluate(([intro, s, fps]) => new Promise((r) => {
    const { engine, director } = window.__am;
    director.intro.t = intro;
    director.override = s;
    engine.passo(1 / fps);
    requestAnimationFrame(() => requestAnimationFrame(r));
  }), [intro, s, FPS]);

  // assenta as partículas e espera o fade-in do canvas
  for (let i = 0; i < 48; i++) await passo(0, 0);
  await page.waitForTimeout(2000);

  const sMax = await page.evaluate(() => window.__am.director.sMax);
  const total = INTRO + sMax * POR_SECAO + 1;
  for (let i = 0; i < total; i++) {
    if (i < INTRO) await passo(i / INTRO, 0);
    else await passo(1, (i - INTRO) / POR_SECAO);
    // só fotografa o que vira arquivo: a abertura inteira e o quadro de cada seção
    if (i <= INTRO || (i - INTRO) % POR_SECAO === 0)
      await page.screenshot({ path: join(dir, `${String(i).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 92 });
    if (i % 50 === 0) console.log(`${nome}: ${i}/${total}`);
  }
  await page.close();

  const ffmpeg = (args, saida) => {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args, saida], { stdio: 'inherit' });
    console.log(`${saida}: ${(statSync(saida).size / 1e6).toFixed(1)} MB`);
  };
  // abertura: Full HD a 30 q/s; toca uma vez (sem busca), então keyframe espaçado e compressão melhor
  ffmpeg(['-framerate', String(FPS), '-i', join(dir, '%04d.jpg'),
    '-vf', `trim=end_frame=${INTRO + 1},fps=30`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an',
    '-preset', 'veryslow', '-crf', '30', '-g', '60', '-bf', '3'], `public/cena/abertura-${nome}.mp4`);
  // telas fixas: o quadro de cada seção (a 0 é o último da abertura)
  for (let k = 0; k <= sMax; k++) {
    const quadro = join(dir, `${String(INTRO + k * POR_SECAO).padStart(4, '0')}.jpg`);
    ffmpeg(['-i', quadro, '-c:v', 'libwebp', '-quality', '85'], `public/cena/tela-${nome}-${k}.webp`);
  }
}
await browser.close();
