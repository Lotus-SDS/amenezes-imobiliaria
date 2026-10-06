// Simulação GPU das partículas (compute shader TSL; no WebGL2 roda via transform feedback).
// Cada partícula persegue o alvo misturado entre dois estados com mola + ruído de fluxo + cursor.
import {
  Fn, instancedArray, instanceIndex, uniform, float, vec3, mix, smoothstep, select, sin, exp, dot, normalize,
  hash, mx_noise_vec3, PI,
} from 'three/tsl';
import { Vector3 } from 'three/webgpu';
import { U } from './uniforms';
import { FORMA, N_FORMAS, gerarFormas } from './shapes/formas';

export class Simulation {
  N: number;
  positions: any;
  sizes: any;
  update: any;
  formaA = uniform(FORMA.ORLA as number);
  formaB = uniform(FORMA.ORLA as number);
  mistura = uniform(0);
  ancora = uniform(new Vector3());
  escala = uniform(2.2);
  dt = uniform(1 / 60);
  amort = uniform(0.88);
  rigidez = uniform(12);
  turb = uniform(0.25);

  // gera os alvos em fatias (async) e só então monta os buffers
  static async criar(N: number) {
    return new Simulation(N, await gerarFormas(N));
  }

  private constructor(N: number, alvosCPU: Float32Array) {
    this.N = N;
    const targets = instancedArray(N * N_FORMAS, 'vec4');
    targets.value.array.set(alvosCPU);

    // começa na orla (o loader em CSS desenha essa mesma linha de luzes)
    const positions = instancedArray(N, 'vec3');
    const sizes = instancedArray(N, 'float');
    const velocities = instancedArray(N, 'vec3');
    for (let i = 0; i < N; i++) {
      positions.value.array[i * 3] = alvosCPU[i * 4];
      positions.value.array[i * 3 + 1] = alvosCPU[i * 4 + 1];
      positions.value.array[i * 3 + 2] = alvosCPU[i * 4 + 2];
      sizes.value.array[i] = alvosCPU[i * 4 + 3];
    }
    this.positions = positions;
    this.sizes = sizes;

    const { formaA, formaB, mistura, ancora, escala, dt, amort, rigidez, turb } = this;

    this.update = Fn(() => {
      const i = instanceIndex;
      const pos = positions.element(i);
      const vel = velocities.element(i);
      const A = targets.element(formaA.toUint().mul(N).add(i));
      const B = targets.element(formaB.toUint().mul(N).add(i));

      // cada partícula tem seu próprio atraso → a transição acontece como uma onda, nunca em bloco
      const atraso = hash(i).mul(0.5);
      const k = smoothstep(atraso, atraso.add(0.5), mistura);
      const mundo = (T: any, f: any) => select(f.equal(0), T.xyz, ancora.add(T.xyz.mul(escala)));
      const alvo = mix(mundo(A, formaA), mundo(B, formaB), k);
      sizes.element(i).assign(mix(A.w, B.w, k));

      // turbulência maior no meio da viagem
      const viagem = sin(k.mul(PI));
      const fluxo = mx_noise_vec3(pos.mul(0.42).add(vec3(0, U.tempo.mul(0.13), U.tempo.mul(0.05))));
      vel.addAssign(alvo.sub(pos).mul(rigidez.mul(dt)));
      vel.addAssign(fluxo.mul(turb.add(viagem.mul(3.5))).mul(dt));

      // cursor: empurra suavemente
      const dv = pos.sub(U.ponteiro);
      const d2 = dot(dv, dv);
      vel.addAssign(normalize(dv.add(vec3(0.0001))).mul(exp(d2.mul(-0.9)).mul(U.ponteiroForca).mul(dt)));

      vel.mulAssign(amort);
      pos.addAssign(vel.mul(dt));
    })().compute(N).setName('Simulação');
  }

  step(renderer: any, dt: number) {
    this.dt.value = Math.min(dt, 1 / 30);
    this.amort.value = Math.pow(0.86, this.dt.value * 60);
    renderer.compute(this.update);
  }
}

export const tamanhoBase = float(0.034);
