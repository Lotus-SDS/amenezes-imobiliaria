// Atmosfera: domo do céu, mar (ondas Gerstner + reflexo analítico do sol) e silhueta da orla.
import {
  BackSide, BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicNodeMaterial, PlaneGeometry, SphereGeometry,
} from 'three/webgpu';
import {
  Fn, float, vec2, vec3, mix, smoothstep, cameraPosition, max, min, positionLocal, positionWorld, varyingProperty, reflect,
  cos, sin, sqrt, exp, select, length, dot, normalize,
} from 'three/tsl';
import { U } from './uniforms';
import { makeSky } from './materials/sky';
import { ORLA_X0, ORLA_X1, alturaPredio, orlaZ } from './shapes/orla';

export type AtmosphereOpts = { mar: number; nuvens: number; detalheMar: number };

export class Atmosphere {
  group = new Group();
  sky: ReturnType<typeof makeSky>;

  constructor(opts: AtmosphereOpts) {
    this.sky = makeSky(opts.nuvens);
    this.group.add(this.criarCeu(), this.criarMar(opts), this.criarOrla());
  }

  // Cor do céu exatamente no horizonte, na direção de um ponto do mundo (usada como névoa)
  horizonteNa = Fn(([p]: any[]) => {
    const dir = p.sub(cameraPosition);
    return this.sky(vec3(dir.x, length(dir.xz).mul(0.004), dir.z));
  });

  private criarCeu() {
    const mat = new MeshBasicNodeMaterial({ side: BackSide, depthWrite: false });
    mat.colorNode = this.sky(positionWorld.sub(cameraPosition));
    mat.fog = false;
    const m = new Mesh(new SphereGeometry(900, 48, 24), mat);
    m.renderOrder = -10;
    m.frustumCulled = false;
    return m;
  }

  private criarMar({ mar, detalheMar }: AtmosphereOpts) {
    // Grade com densidade maior perto da câmera (profundidade quadrática, largura crescente)
    const g = new PlaneGeometry(1, 1, mar, mar);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) + 0.5, v = pos.getY(i) + 0.5;
      pos.setXYZ(i, (u - 0.5) * (70 + 950 * v ** 1.5), 0, 22 - 425 * v * v);
    }
    g.computeBoundingSphere();

    // Ondas Gerstner: [ângulo, inclinação, comprimento de onda]
    const ondas: [number, number, number][] = [[0.35, 0.15, 11], [1.95, 0.11, 6.2], [-0.75, 0.09, 3.6], [2.7, 0.07, 2.1]];
    const vNormal = varyingProperty('vec3', 'vNormalMar');
    const vPos = varyingProperty('vec3', 'vPosMar');

    const mat = new MeshBasicNodeMaterial();
    mat.positionNode = Fn(() => {
      const p = positionLocal;
      const dist = length(p.xz.sub(vec2(0, 12)));
      const fade = smoothstep(280.0, 30.0, dist);
      const desloc = vec3(0).toVar();
      const T = vec3(1, 0, 0).toVar();
      const B = vec3(0, 0, 1).toVar();
      for (const [ang, steep, L] of ondas) {
        const k = (2 * Math.PI) / L;
        const c = Math.sqrt(9.8 / k) * 0.55;
        const d = vec2(Math.cos(ang), Math.sin(ang));
        const q = float(steep).mul(fade);
        const f = dot(d, p.xz).mul(k).sub(U.tempo.mul(c * k));
        const a = q.div(k);
        desloc.addAssign(vec3(d.x.mul(a).mul(cos(f)), a.mul(sin(f)), d.y.mul(a).mul(cos(f))));
        T.addAssign(vec3(d.x.mul(d.x).mul(q).mul(sin(f)).negate(), d.x.mul(q).mul(cos(f)), d.x.mul(d.y).mul(q).mul(sin(f)).negate()));
        B.addAssign(vec3(d.x.mul(d.y).mul(q).mul(sin(f)).negate(), d.y.mul(q).mul(cos(f)), d.y.mul(d.y).mul(q).mul(sin(f)).negate()));
      }
      const final = p.add(desloc);
      vNormal.assign(normalize(B.cross(T)));
      vPos.assign(final);
      return final;
    })();

    mat.colorNode = Fn(() => {
      const P = vPos;
      const dist = length(P.xz.sub(cameraPosition.xz));
      const N = normalize(vNormal).toVar();

      // ondulação fina: senos direcionais com derivada analítica (barato em qualquer GPU)
      const det = smoothstep(90.0, 4.0, dist);
      const rip: [number, number, number, number][] = [[0.9, 1.6, 0.035, 1.3], [2.3, 2.7, 0.025, 1.9], [-0.4, 4.1, 0.018, 2.6], [1.4, 6.3, 0.012, 3.4]];
      for (const [ang, k, amp, w] of rip.slice(0, detalheMar)) {
        const d = vec2(Math.cos(ang), Math.sin(ang));
        const f = dot(d, P.xz).mul(k).sub(U.tempo.mul(w));
        const s = cos(f).mul(amp * k).mul(det);
        N.subAssign(vec3(d.x.mul(s), 0, d.y.mul(s)));
      }
      N.assign(normalize(N));

      const V = normalize(cameraPosition.sub(P));
      const NdV = max(dot(N, V), 0.0);
      const R = reflect(V.negate(), N).toVar();
      R.y.assign(max(R.y.abs(), 0.002));
      const F = float(0.02).add(float(0.98).mul(float(1).sub(NdV).pow(5.0)));

      // reflexo do céu
      const refl = this.sky(R).toVar();

      // reflexo analítico da esfera dourada (raio × esfera): o símbolo aparece no mar, com a distorção das ondas
      const oc = P.sub(U.solPos);
      const b = dot(oc, R);
      const raio = U.solRaio.mul(0.98);
      const h = b.mul(b).sub(dot(oc, oc).sub(raio.mul(raio)));
      const tHit = b.negate().sub(sqrt(max(h, 0.0)));
      const acerto = select(h.greaterThan(0.0).and(tHit.greaterThan(0.0)), float(1), float(0)).mul(U.materializar);
      const Ns = normalize(P.add(R.mul(tHit)).sub(U.solPos));
      const ndr = max(dot(Ns, R.negate()), 0.0);
      const ouroRefl = vec3(1.0, 0.72, 0.18).mul(this.sky(reflect(R, Ns)).mul(0.9).add(ndr.pow(1.5).mul(U.solBrilho).mul(1.4)));
      refl.assign(mix(refl, ouroRefl, acerto));

      // brilho do sol na água (a esfera como fonte de luz): rastro de cintilação
      const L = normalize(U.solPos.sub(P));
      const H = normalize(L.add(V));
      const nh = max(dot(N, H), 0.0);
      const brilhoSol = nh.pow(900.0).mul(60.0).add(nh.pow(90.0).mul(0.9)).mul(U.solBrilho).mul(U.materializar.mul(0.85).add(0.15));

      // água profunda com leve espalhamento nas cristas
      const crista = smoothstep(-0.1, 0.25, P.y).mul(0.06);
      const profundo = U.marProfundo.add(U.horizonte.mul(crista));
      const cor = mix(profundo, refl, F).add(U.brilho.mul(brilhoSol)).toVar();

      // névoa: o mar se funde com o céu no horizonte
      const nevoa = float(1).sub(exp(dist.mul(-0.0065)));
      return mix(cor, this.horizonteNa(P), min(nevoa.mul(1.08), 1.0));
    })();

    const m = new Mesh(g, mat);
    m.frustumCulled = false;
    return m;
  }

  private criarOrla() {
    // Faixa de prédios (topos planos, arestas nítidas) + morros ao fundo
    const pts: number[] = [];
    const quad = (x0: number, x1: number, z0: number, z1: number, y0: number, y1a: number, y1b: number) => {
      pts.push(x0, y0, z0, x1, y0, z1, x1, y1b, z1, x0, y0, z0, x1, y1b, z1, x0, y1a, z0);
    };
    const W = 1.6;
    for (let x = ORLA_X0; x < ORLA_X1; x += W) {
      const h = alturaPredio(x + 0.01);
      quad(x, x + W, orlaZ(x), orlaZ(x + W), -1, h, h);
    }
    // morros: suaves, mais altos ao centro, descendo até o mar aberto
    const morro = (x: number) => {
      const t = (x - ORLA_X0) / (ORLA_X1 + 25 - ORLA_X0);
      return (2.4 + Math.sin(x * 0.045) * 1.6 + Math.sin(x * 0.11 + 1.3) * 0.8) * Math.min(1, (1 - t) * 3.5);
    };
    for (let x = ORLA_X0 - 30; x < ORLA_X1 + 25; x += 2) {
      quad(x, x + 2, orlaZ(x) - 38, orlaZ(x + 2) - 38, -1, morro(x) + 2.2, morro(x + 2) + 2.2);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pts, 3));

    const mat = new MeshBasicNodeMaterial();
    mat.colorNode = Fn(() => {
      const P = positionWorld;
      const escuro = U.zenite.mul(0.22).add(U.horizonte.mul(0.06));
      const dist = length(P.xz.sub(cameraPosition.xz));
      const nevoa = float(1).sub(exp(dist.mul(-0.0105))).mul(0.85);
      // leve bruma subindo do mar na base
      const base = smoothstep(1.2, -0.2, P.y).mul(0.35);
      return mix(escuro, this.horizonteNa(P), min(nevoa.add(base), 0.96));
    })();
    const m = new Mesh(g, mat);
    m.renderOrder = -5;
    return m;
  }
}
