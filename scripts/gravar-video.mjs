// Grava o vídeo da cena para aparelhos fracos (modo 'video', src/scripts/video.ts).
// Uso: com o dev server rodando (npx astro dev --port 4321): `node scripts/gravar-video.mjs [url]`.
// Abre a home com ?poster&debug&gravar&tier=alto no Chrome com GPU, avança a cena quadro a quadro
// (abertura + 1 s por seção) e junta os quadros com ffmpeg em public/video/cena-{h,v}.mp4.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL_BASE = process.argv[2] ?? 'http://localhost:4321/';
// precisam bater com src/scripts/video.ts
const FPS = 24;
const INTRO = 135; // quadros da abertura (5,6 s)
const FORMATOS = { h: { width: 1280, height: 720 }, v: { width: 720, height: 1280 } };

const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--enable-unsafe-webgpu'] });
mkdirSync('public/video', { recursive: true });

for (const [nome, viewport] of Object.entries(FORMATOS)) {
  const dir = join(tmpdir(), `am-quadros-${nome}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir);

  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.goto(`${URL_BASE}?poster&debug&gravar&tier=alto`);
  await page.waitForFunction(() => window.__am?.engine?.sim, null, { timeout: 120_000 });
  // painel de debug e grão ficam fora: o grão é aplicado ao vivo por cima do vídeo
  await page.addStyleTag({ content: '.lil-gui, .grao { display: none !important; } html { scrollbar-width: none; }' });

  const passo = (intro, s) => page.evaluate(([intro, s]) => new Promise((r) => {
    const { engine, director } = window.__am;
    director.intro.t = intro;
    director.override = s;
    engine.passo(1 / 24, 3);
    requestAnimationFrame(() => requestAnimationFrame(r));
  }), [intro, s]);

  // assenta as partículas e espera o fade-in do canvas
  for (let i = 0; i < 48; i++) await passo(0, 0);
  await page.waitForTimeout(2000);

  const sMax = await page.evaluate(() => window.__am.director.sMax);
  const total = INTRO + sMax * FPS + 1;
  for (let i = 0; i < total; i++) {
    if (i < INTRO) await passo(i / INTRO, 0);
    else await passo(1, (i - INTRO) / FPS);
    await page.screenshot({ path: join(dir, `${String(i).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 92 });
    if (i % 50 === 0) console.log(`${nome}: ${i}/${total}`);
  }
  await page.close();

  const saida = `public/video/cena-${nome}.mp4`;
  // keyframe a cada 12 quadros: a rolagem busca rápido nos dois sentidos sem inflar o arquivo
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(dir, '%04d.jpg'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '30', '-g', '12', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', saida], { stdio: 'inherit' });
  console.log(`${saida}: ${total} quadros, ${(statSync(saida).size / 1e6).toFixed(1)} MB`);
}
await browser.close();
