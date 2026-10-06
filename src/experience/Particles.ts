// Renderização das partículas: pontos de luz quente (aditivos) + seus reflexos esticados na água.
import { AdditiveBlending, Color, Group, Sprite, SpriteNodeMaterial } from 'three/webgpu';
import {
  Fn, float, vec2, vec3, mix, smoothstep, uv, length, hash, instanceIndex, sin, max,
} from 'three/tsl';
import { U } from './uniforms';
import { Simulation, tamanhoBase } from './Simulation';
import { brand } from '../../brand.config';

const LUZ = new Color(brand.experiencia.luzOrla);
const OURO = new Color(brand.experiencia.ouro);

export class Particles {
  group = new Group();

  constructor(sim: Simulation) {
    const semente = hash(instanceIndex.add(7));
    const pos = sim.positions.toAttribute();
    const tam = sim.sizes.toAttribute();
    const pisca = sin(U.tempo.mul(semente.mul(2.5).add(0.8)).add(semente.mul(30.0))).mul(0.22).add(0.88);
    const corNoite = mix(vec3(LUZ.r, LUZ.g, LUZ.b), vec3(OURO.r, OURO.g * 0.9, OURO.b * 0.6), semente);
    // de dia, ouro saturado (sem azul): a soma aditiva fica dourada em vez de branca
    const corDia = mix(vec3(1.0, 0.55, 0.06), vec3(1.0, 0.42, 0.02), semente);
    const cor = mix(corNoite, corDia, U.dia).mul(2.6);
    const disco = Fn(() => {
      const d = length(uv().sub(0.5)).mul(2.0);
      return float(1).sub(smoothstep(0.0, 1.0, d)).pow(1.8);
    });

    // pontos
    const m = new SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending });
    m.positionNode = pos;
    m.scaleNode = tam.mul(U.pTamanho).mul(tamanhoBase).mul(pisca);
    m.colorNode = cor.mul(U.pBrilho);
    m.opacityNode = disco().mul(U.pAlpha).mul(smoothstep(0.0, 0.05, tam));
    const pontos = new Sprite(m);
    pontos.count = sim.N;
    pontos.frustumCulled = false;
    pontos.renderOrder = 10;

    // reflexos: espelho em y, esticados e tremulando com as ondas (sem passe extra de render)
    const r = new SpriteNodeMaterial({ transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending });
    r.positionNode = vec3(pos.x.add(sin(U.tempo.mul(1.6).add(pos.z.mul(0.7))).mul(0.06)), pos.y.negate().sub(0.04), pos.z);
    r.scaleNode = vec2(1.0, 3.2).mul(tam.mul(U.pTamanho).mul(tamanhoBase).mul(pisca));
    r.colorNode = cor.mul(0.5).mul(U.pBrilho);
    r.opacityNode = disco().mul(U.pAlpha).mul(0.35).mul(smoothstep(0.08, 0.6, pos.y)).mul(max(float(1).sub(pos.y.mul(0.06)), 0.0));
    const reflexos = new Sprite(r);
    reflexos.count = sim.N;
    reflexos.frustumCulled = false;
    reflexos.renderOrder = 5;

    this.group.add(reflexos, pontos);
  }
}
