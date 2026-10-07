// Engine: renderer, cena, câmera, laço de render, resize, pausa e dispose.
// Recebe do ScrollDirector "qual estado de cena mostrar" e cuida de suavizar e desenhar.
import {
  AdditiveBlending, NeutralToneMapping, Color, PerspectiveCamera, Scene, Sprite, SpriteNodeMaterial,
  Vector3, WebGPURenderer,
} from 'three/webgpu';
import { float, length, smoothstep, uniform, uv, vec3 } from 'three/tsl';
import { brand } from '../../brand.config';
import { U } from './uniforms';
import { Atmosphere } from './Atmosphere';
import { Symbol } from './Symbol';
import { Simulation } from './Simulation';
import { Particles } from './Particles';
import { PostFX } from './PostFX';
import { QualityManager, type Modo } from './QualityManager';
import { enquadrar, moldar, type Estado, type Moldura } from './cenas';
import { ORLA_X0, alturaPredio, orlaZ } from './shapes/orla';

const PALETA = brand.experiencia.ceu.map((c) => ({
  h: c.h, z: new Color(c.zenite), hz: new Color(c.horizonte), b: new Color(c.brilho),
}));
const tmp = { z: new Color(), hz: new Color(), b: new Color() };

export type Fonte = { avaliar(): { estado: Estado; formas: [number, number, number]; moldura?: Moldura | null } };

export class Engine {
  renderer!: WebGPURenderer;
  scene = new Scene();
  camera = new PerspectiveCamera(35, 1, 0.1, 2000);
  atm!: Atmosphere;
  symbol!: Symbol;
  sim!: Simulation;
  particles!: Particles;
  post: PostFX | null = null;
  qm: QualityManager;
  fonte: Fonte | null = null;
  atual: Estado | null = null;
  ativo = true;
  webgpu = false;
  // ?gravar: sem laço próprio; scripts/gravar-video.mjs avança quadro a quadro com passo()
  gravando = new URLSearchParams(location.search).has('gravar');
  // entradas da interação (InteractionManager)
  parallax = { x: 0, y: 0 };
  giro = 0;
  private relogio = performance.now();
  private tempo = 0;
  private alvoCam = new Vector3();
  private dprBase = 1;
  private recompensas: { sprite: Sprite; t0: number; escala: any }[] = [];

  constructor(public canvas: HTMLCanvasElement, public modo: Exclude<Modo, 'estatico' | 'video'>) {
    this.qm = new QualityManager(modo);
  }

  get tier() { return brand.experiencia.tiers[this.modo]; }

  async iniciar() {
    const forceWebGL = new URLSearchParams(location.search).has('webgl');
    this.renderer = new WebGPURenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance', forceWebGL });
    await this.renderer.init();
    this.webgpu = !!(this.renderer.backend as any).isWebGPUBackend;
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    (this.renderer as any).onDeviceLost = () => this.canvas.dispatchEvent(new CustomEvent('experiencia:falha'));

    // montagem em fatias: cede o processador entre etapas (nenhuma tarefa longa travando a rolagem)
    const t = this.tier;
    this.atm = new Atmosphere({ mar: t.mar, nuvens: t.nuvens, detalheMar: this.modo === 'baixo' ? 2 : 4 });
    await ceder();
    this.symbol = new Symbol(this.atm.sky, t.esfera);
    await ceder();
    this.sim = await Simulation.criar(t.particulas);
    await ceder();
    this.particles = new Particles(this.sim);
    this.scene.add(this.atm.group, this.symbol.group, this.particles.group);

    if (t.bloom) this.post = new PostFX(this.renderer, this.scene, this.camera, { msaa: t.msaa });

    this.qm.onEscala = () => this.redimensionar();
    this.qm.onCorte = (nivel) => {
      // ordem de corte: bloom → metade das partículas → desiste (pôster)
      if (nivel === 1 && this.post) this.post.desligarBloom();
      else if (nivel <= 2) (this.particles.group.children as Sprite[]).forEach((s) => (s.count = Math.floor(this.sim.N * 0.5)));
      else this.canvas.dispatchEvent(new CustomEvent('experiencia:falha'));
    };

    this.redimensionar();
    new ResizeObserver(() => this.redimensionar()).observe(this.canvas);
    document.addEventListener('visibilitychange', () => this.sincronizarLaco());

    // pré-compila todos os shaders antes do primeiro quadro (sem engasgo na abertura)
    await this.renderer.compileAsync(this.scene, this.camera);
    this.sincronizarLaco();
  }

  redimensionar() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.dprBase = Math.min(devicePixelRatio || 1, this.tier.dprMax);
    this.renderer.setPixelRatio(this.dprBase * this.qm.escala);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  pausar(p: boolean) {
    this.ativo = !p;
    this.sincronizarLaco();
  }

  private sincronizarLaco() {
    const rodar = this.ativo && !document.hidden && !this.gravando;
    this.renderer.setAnimationLoop(rodar ? () => this.quadro() : null);
    this.relogio = performance.now();
  }

  // Céu interpolado pela hora
  private aplicarHora(h: number) {
    h = ((h % 1) + 1) % 1;
    let i = 0;
    while (i < PALETA.length - 2 && h > PALETA[i + 1].h) i++;
    const a = PALETA[i], b = PALETA[i + 1];
    const f = (h - a.h) / (b.h - a.h);
    U.zenite.value.copy(tmp.z.copy(a.z).lerp(b.z, f));
    U.horizonte.value.copy(tmp.hz.copy(a.hz).lerp(b.hz, f));
    U.brilho.value.copy(tmp.b.copy(a.b).lerp(b.b, f));
    U.marProfundo.value.copy(U.zenite.value).multiplyScalar(0.16).lerp(U.horizonte.value, 0.04);
    const noite = Math.max(1 - smooth(0.06, 0.2, h), smooth(0.86, 0.97, h));
    U.estrelas.value = noite;
    const dia = Math.max(0, 1 - Math.abs(h - 0.5) / 0.22);
    U.dia.value = dia;
    U.pBrilho.value = 1 - dia * 0.55;
    // de dia o céu já é claro: menos bloom para não lavar a imagem
    if (this.post && this.post.forca.value > 0) this.post.forca.value = 0.42 * (1 - dia * 0.65);
    // o núcleo do sol brilha mais à noite e no pôr do sol, menos ao meio-dia
    U.solBrilho.value = 0.55 + noite * 0.7 + Math.max(0, 1 - Math.abs(h - 0.75) / 0.12) * 0.45 + Math.max(0, 1 - Math.abs(h - 0.25) / 0.12) * 0.35;
  }

  // Gravação do vídeo: um quadro com passo de tempo fixo. `extras` passos a mais só na simulação,
  // para as silhuetas se formarem dentro de 1 s de vídeo por seção (ao vivo, a pessoa para e espera).
  passo(dt: number, extras = 0) {
    for (let i = 0; i < extras; i++) this.sim.step(this.renderer, dt);
    this.quadro(dt);
  }

  private quadro(dtFixo?: number) {
    const agora = performance.now();
    const ms = agora - this.relogio;
    this.relogio = agora;
    const dt = dtFixo ?? Math.min(ms / 1000, 1 / 20);
    this.tempo += dt;
    if (!this.gravando) this.qm.amostrar(ms);

    const fonte = this.fonte?.avaliar();
    if (fonte) {
      const alvo = moldar(enquadrar(fonte.estado, this.camera.aspect), fonte.moldura ?? null, this.camera.fov, this.camera.aspect);
      if (!this.atual) this.atual = structuredClone(alvo);
      suavizar(this.atual, alvo, this.gravando ? 1 : 1 - Math.exp(-dt * 5.5));
      const [a, b, m] = fonte.formas;
      this.sim.formaA.value = a;
      this.sim.formaB.value = b;
      this.sim.mistura.value = m;
    }
    const e = this.atual;
    if (e) {
      this.aplicarHora(e.hora);
      U.tempo.value = this.tempo;
      U.solPos.value.set(...e.sol);
      U.solRaio.value = e.escala;
      U.materializar.value = e.materializar;
      U.gravar.value = e.gravar;
      U.gravarBrilho.value = e.gravarBrilho;
      U.liquido.value = e.liquido;
      U.nuvens.value = e.nuvens;
      U.pAlpha.value = e.pAlpha;
      U.pTamanho.value = e.pTamanho;
      this.sim.ancora.value.set(...e.sol);
      this.sim.escala.value = e.escala;

      // câmera com parallax do cursor/giroscópio
      this.camera.position.set(e.cam[0] + this.parallax.x * 0.45, e.cam[1] - this.parallax.y * 0.22, e.cam[2]);
      this.alvoCam.set(e.alvo[0] + this.parallax.x * 0.9, e.alvo[1] - this.parallax.y * 0.5, e.alvo[2]);
      this.camera.lookAt(this.alvoCam);

      // o símbolo sempre encara a câmera (a gravação fica legível), com inclinação viva
      const g = this.symbol.group;
      g.position.set(...e.sol);
      g.scale.setScalar(e.escala);
      g.lookAt(this.camera.position);
      g.rotateY(this.parallax.x * 0.35 + this.giro);
      g.rotateX(-this.parallax.y * 0.25 + Math.sin(this.tempo * 0.4) * 0.03);
      this.symbol.update(dt, this.tempo);
    }

    this.atualizarRecompensas(agora);
    this.sim.step(this.renderer, dt);
    if (this.post) this.post.render();
    else this.renderer.render(this.scene, this.camera);
  }

  // Recompensa da conversão: acende uma luz nova na orla ("a próxima é a sua")
  recompensa() {
    const escala = uniform(0);
    const m = new SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending });
    const d = length(uv().sub(0.5)).mul(2.0);
    m.colorNode = vec3(1.0, 0.85, 0.45).mul(4.0);
    m.opacityNode = float(1).sub(smoothstep(0.0, 1.0, d)).pow(2.2);
    m.scaleNode = escala;
    const s = new Sprite(m);
    const x = ORLA_X0 + 30 + Math.random() * 90;
    s.position.set(x, alturaPredio(x) * 0.6 + 0.3, orlaZ(x) + 0.5);
    s.renderOrder = 12;
    this.scene.add(s);
    this.recompensas.push({ sprite: s, t0: performance.now(), escala });
    U.pTamanho.value *= 1.6;
  }

  private atualizarRecompensas(agora: number) {
    for (const r of this.recompensas) {
      const t = (agora - r.t0) / 1000;
      // pulso grande e depois assenta numa luz permanente, maior que as outras
      r.escala.value = t < 1.4 ? Math.sin(Math.min(t / 1.4, 1) * Math.PI) * 9 + Math.min(t / 1.4, 1) * 0.9 : 0.9 + Math.sin(agora / 300) * 0.08;
    }
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.scene.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    this.post?.pipeline.dispose();
    this.renderer.dispose();
  }
}

const ceder = () => new Promise<void>((r) => ((globalThis as any).scheduler?.yield ? (globalThis as any).scheduler.yield().then(r) : setTimeout(r, 0)));

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function suavizar(atual: any, alvo: any, k: number) {
  for (const chave in alvo) {
    const v = alvo[chave];
    if (Array.isArray(v)) v.forEach((x: number, i: number) => (atual[chave][i] += (x - atual[chave][i]) * k));
    else if (chave === 'forma') atual[chave] = v;
    else if (atual[chave] === undefined) atual[chave] = v;
    else atual[chave] += (v - atual[chave]) * k;
  }
}

