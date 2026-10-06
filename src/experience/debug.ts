// ?debug na URL: painel lil-gui, monitor de performance e scrubber dos atos.
import GUI from 'lil-gui';
import type { Engine } from './Engine';
import type { ScrollDirector } from './ScrollDirector';
import { U } from './uniforms';

export function montarDebug(engine: Engine, director: ScrollDirector) {
  const gui = new GUI({ title: 'A.Menezes · debug' });
  const info = {
    modo: engine.modo,
    backend: engine.webgpu ? 'WebGPU' : 'WebGL2',
    particulas: engine.sim.N,
    fps: 0,
    ms: 0,
    escala: 1,
  };
  const f = gui.addFolder('Performance');
  f.add(info, 'modo').disable();
  f.add(info, 'backend').disable();
  f.add(info, 'particulas').disable();
  f.add(info, 'fps').listen().disable();
  f.add(info, 'ms').listen().disable();
  f.add(info, 'escala').listen().disable();

  const timeline = { abertura: director.intro.t, travarCena: false, cena: 0 };
  const t = gui.addFolder('Timeline');
  t.add(timeline, 'abertura', 0, 1, 0.001).name('Atos 1–4').onChange((v: number) => { director.intro.t = v; });
  t.add(timeline, 'travarCena').name('Travar cena').onChange((v: boolean) => { director.override = v ? timeline.cena : null; });
  t.add(timeline, 'cena', 0, Math.max(1, director.sMax), 0.001).name('Cena (s)').onChange((v: number) => { if (timeline.travarCena) director.override = v; });

  const m = gui.addFolder('Material');
  m.add(U.irid, 'value', 0, 1.5, 0.01).name('Iridescência');
  m.add(U.ponteiroForca, 'value', 0, 20, 0.1).name('Força do cursor');
  gui.add({ recompensa: () => engine.recompensa() }, 'recompensa').name('▶ Recompensa');

  setInterval(() => {
    info.fps = Math.round(engine.qm.fps);
    info.ms = Math.round(engine.qm.msMedio * 10) / 10;
    info.escala = Math.round(engine.qm.escala * 100) / 100;
  }, 500);
}
