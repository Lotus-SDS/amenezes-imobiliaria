// InteractionManager: mouse, toque, giroscópio e arraste com inércia → parallax, inclinação do símbolo
// e um "ponteiro de mundo" que empurra as partículas.
import { Plane, Raycaster, Vector2, Vector3 } from 'three/webgpu';
import { U } from './uniforms';
import type { Engine } from './Engine';

export class InteractionManager {
  private alvo = { x: 0, y: 0 };
  private ray = new Raycaster();
  private ndc = new Vector2();
  private plano = new Plane(new Vector3(0, 0, 1), 0);
  private hit = new Vector3();
  private ultimoMov = 0;
  private arrastando = false;
  private ultimoX = 0;
  private vGiro = 0;

  constructor(private engine: Engine) {
    addEventListener('pointermove', this.mover, { passive: true });
    addEventListener('pointerdown', this.descer, { passive: true });
    addEventListener('pointerup', () => (this.arrastando = false), { passive: true });
    // giroscópio só onde não exige permissão (Android); no iOS seria um pop-up intrusivo
    if (matchMedia('(pointer: coarse)').matches && typeof (DeviceOrientationEvent as any)?.requestPermission !== 'function') {
      addEventListener('deviceorientation', this.girar, { passive: true });
    }
    const passo = () => { this.atualizar(); requestAnimationFrame(passo); };
    requestAnimationFrame(passo);
  }

  private mover = (e: PointerEvent) => {
    this.alvo.x = (e.clientX / innerWidth) * 2 - 1;
    this.alvo.y = (e.clientY / innerHeight) * 2 - 1;
    this.ultimoMov = performance.now();
    this.ndc.set(this.alvo.x, -this.alvo.y);
    if (this.arrastando && e.pointerType === 'mouse') {
      this.vGiro += (e.clientX - this.ultimoX) * 0.0009;
      this.ultimoX = e.clientX;
    }
  };

  private descer = (e: PointerEvent) => {
    // arrastar só no fundo (não em textos, botões, formulários)
    const alvo = e.target as HTMLElement;
    if (alvo.closest('a,button,input,select,textarea,label,[data-sem-arraste]')) return;
    this.arrastando = true;
    this.ultimoX = e.clientX;
  };

  private girar = (e: DeviceOrientationEvent) => {
    if (e.gamma == null || e.beta == null) return;
    this.alvo.x = Math.max(-1, Math.min(1, e.gamma / 30));
    this.alvo.y = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
  };

  private atualizar() {
    if (document.documentElement.classList.contains('modo-poster')) return; // captura do pôster: cena parada, de frente
    const p = this.engine.parallax;
    // mola criticamente amortecida (inércia sem oscilar)
    p.x += (this.alvo.x - p.x) * 0.06;
    p.y += (this.alvo.y - p.y) * 0.06;
    // giro do arraste com momento, voltando devagar ao centro
    this.engine.giro += this.vGiro;
    this.vGiro *= 0.94;
    this.engine.giro *= 0.985;

    // ponteiro no plano do sol
    this.plano.constant = -U.solPos.value.z;
    this.ray.setFromCamera(this.ndc, this.engine.camera);
    if (this.ray.ray.intersectPlane(this.plano, this.hit)) U.ponteiro.value.copy(this.hit);
    const recente = performance.now() - this.ultimoMov < 600;
    U.ponteiroForca.value += ((recente ? 6 : 0) - U.ponteiroForca.value) * 0.08;
  }
}
