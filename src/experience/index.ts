// Ponto de entrada da experiência 3D — carregado sob demanda, em chunk separado.
// O site funciona 100% sem este arquivo; ele só acrescenta a camada viva.
import { Engine } from './Engine';
import { ScrollDirector } from './ScrollDirector';
import { InteractionManager } from './InteractionManager';
import { AudioEngine } from './AudioEngine';
import type { Modo } from './QualityManager';

export type Experiencia = { engine: Engine; director: ScrollDirector; audio: AudioEngine };

export async function iniciarExperiencia(canvas: HTMLCanvasElement, modo: Exclude<Modo, 'estatico' | 'video'>): Promise<Experiencia | null> {
  const engine = new Engine(canvas, modo);
  await engine.iniciar();
  const director = new ScrollDirector(engine);
  director.montar();
  new InteractionManager(engine);
  const audio = new AudioEngine();

  if (new URLSearchParams(location.search).has('debug')) {
    import('./debug').then((m) => m.montarDebug(engine, director));
    (window as any).__am = { engine, director };
  }
  return { engine, director, audio };
}
