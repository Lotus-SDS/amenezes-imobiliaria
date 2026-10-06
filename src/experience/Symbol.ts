// O Símbolo: o disco do selo A.Menezes como um sol de ouro líquido.
// · deformação viva no vertex (ruído em 2 escalas, normal recalculada por diferenças finitas)
// · ouro físico aproximado: Fresnel de metal + iridescência de filme fino + núcleo luminoso
// · "1957" gravado em relevo (mapa de altura gerado em canvas)
// · o traço crescente azul do logo, em esmalte, afinando nas pontas
import {
  CanvasTexture, Group, LinearFilter, Mesh, MeshBasicNodeMaterial, SphereGeometry, TorusGeometry,
} from 'three/webgpu';
import {
  Fn, float, vec2, vec3, vec4, mix, smoothstep, cameraPosition, max, positionLocal, normalLocal, varyingProperty, reflect,
  cos, sin, sqrt, texture, uv, normalize, dot, modelWorldMatrix, mx_noise_float, select, cross, abs, Discard, PI,
} from 'three/tsl';
import { Color } from 'three/webgpu';
import { U } from './uniforms';
import { brand } from '../../brand.config';

const ESMALTE = new Color(brand.experiencia.esmalte);

// Mapa de altura do "1957": texto branco com halo suave (shadowBlur funciona até no Safari)
function texturaGravacao() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, 512, 512);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `600 150px ${brand.fontes.display}`;
  g.shadowColor = '#fff';
  g.shadowBlur = 10;
  g.fillText('1957', 256, 262);
  g.shadowBlur = 0;
  g.font = `500 26px ${brand.fontes.texto}`;
  g.fillText('A · M E N E Z E S', 256, 368);
  const t = new CanvasTexture(c);
  t.minFilter = t.magFilter = LinearFilter;
  t.generateMipmaps = false;
  return t;
}

export class Symbol {
  group = new Group();
  sphere: Mesh;
  crescent: Mesh;

  constructor(sky: any, segmentos: number) {
    this.sphere = this.criarEsfera(sky, segmentos);
    this.crescent = this.criarCrescente(sky);
    this.group.add(this.sphere, this.crescent);
  }

  private criarEsfera(sky: any, seg: number) {
    const geo = new SphereGeometry(1, seg, Math.round(seg * 0.75));
    const mat = new MeshBasicNodeMaterial();
    const tex = texturaGravacao();

    const vN = varyingProperty('vec3', 'vNormalSol');
    const vP = varyingProperty('vec3', 'vPosSol');
    const vO = varyingProperty('vec3', 'vObjSol');

    // deslocamento líquido ao longo da normal
    const desloc = Fn(([q]: any[]) => {
      const t = U.tempo;
      const a = mx_noise_float(q.mul(1.25).add(vec3(0, t.mul(0.22), t.mul(0.09)))).mul(0.075);
      const b = mx_noise_float(q.mul(3.1).sub(vec3(t.mul(0.31), 0, t.mul(0.17)))).mul(0.02);
      return a.add(b).mul(U.liquido);
    });

    mat.positionNode = Fn(() => {
      const n = normalLocal.normalize();
      const p = positionLocal;
      // base tangente estável (troca o eixo perto dos polos)
      const ref = select(abs(n.y).greaterThan(0.95), vec3(1, 0, 0), vec3(0, 1, 0));
      const t = normalize(cross(n, ref));
      const b = cross(n, t);
      const e = 0.012;
      const p0 = n.mul(float(1).add(desloc(n)));
      const n1 = normalize(n.add(t.mul(e)));
      const n2 = normalize(n.add(b.mul(e)));
      const p1 = n1.mul(float(1).add(desloc(n1)));
      const p2 = n2.mul(float(1).add(desloc(n2)));
      const nn = normalize(cross(p1.sub(p0), p2.sub(p0)));
      vN.assign(normalize(modelWorldMatrix.mul(vec4(nn, 0)).xyz));
      vP.assign(modelWorldMatrix.mul(vec4(p0, 1)).xyz);
      vO.assign(p);
      return p0;
    })();

    mat.colorNode = Fn(() => {
      // dissolução: o ouro nasce das partículas com borda incandescente
      const ruido = mx_noise_float(vO.mul(2.6).add(U.tempo.mul(0.05))).mul(0.5).add(0.5);
      const corte = U.materializar.mul(1.15).sub(0.075);
      Discard(ruido.greaterThan(corte));
      const borda = smoothstep(0.07, 0.0, corte.sub(ruido)).mul(smoothstep(0.999, 0.9, U.materializar));

      const N = normalize(vN).toVar();

      // gravação "1957" na face voltada para a câmera (o grupo sempre olha para a câmera)
      const frente = smoothstep(0.15, 0.55, vO.z);
      const uvG = vO.xy.mul(0.62).add(0.5);
      const e = 1.0 / 512.0;
      const h0 = texture(tex, uvG).r;
      const hx = texture(tex, uvG.add(vec2(e, 0))).r.sub(h0);
      const hy = texture(tex, uvG.add(vec2(0, e))).r.sub(h0);
      const prof = U.gravar.mul(frente).mul(9.0);
      // base da tela no mundo: o grupo olha para a câmera, então x/y do objeto ≈ x/y da tela
      const X = normalize(modelWorldMatrix.mul(vec4(1, 0, 0, 0)).xyz);
      const Y = normalize(modelWorldMatrix.mul(vec4(0, 1, 0, 0)).xyz);
      N.assign(normalize(N.add(X.mul(hx).add(Y.mul(hy)).mul(prof))));

      const V = normalize(cameraPosition.sub(vP));
      const NdV = max(dot(N, V), 0.0);
      const R = reflect(V.negate(), N);

      // ambiente: céu acima, mar escuro com brilho do horizonte abaixo
      const ceu = sky(R);
      const mar = mix(U.marProfundo.mul(0.7).add(vec3(0.05, 0.03, 0.0)), U.horizonte.mul(0.95), max(R.y.add(1.0), 0.0).pow(40.0));
      // ambiente aquecido: o ouro nunca esverdeia ao refletir o azul
      const amb = mix(mar, ceu, smoothstep(-0.03, 0.03, R.y)).mul(vec3(1.16, 1.0, 0.72));

      // Fresnel de metal (Schlick) com F0 = ouro da marca
      const F0 = vec3(1.0, 0.72, 0.2); // F0 do ouro real (1, .77, .34) aquecido para o amarelo A.Menezes
      const F = F0.add(vec3(1).sub(F0).mul(float(1).sub(NdV).pow(5.0))).toVar();

      // iridescência de filme fino: interferência por comprimento de onda (RGB ≈ 650/532/450 nm)
      const espessura = mx_noise_float(vO.mul(1.7).add(U.tempo.mul(0.04))).mul(230.0).add(420.0);
      const cosT = sqrt(max(float(1).sub(float(1).sub(NdV.mul(NdV)).div(1.69)), 0.0));
      const fase = espessura.mul(cosT).mul(4.0 * Math.PI * 1.3);
      const interf = vec3(cos(fase.div(650.0)), cos(fase.div(532.0)), cos(fase.div(450.0))).mul(0.5).add(0.5);
      F.assign(mix(F, F.mul(interf).mul(1.7), U.irid.mul(float(1).sub(NdV).pow(1.4))));

      const especular = amb.mul(F).mul(1.75);
      // luz-chave alta à esquerda: o brilho "molhado" que faz o ouro parecer líquido e polido
      const Lk = normalize(vec3(-0.55, 0.75, 0.35));
      const rk = max(dot(R, Lk), 0.0);
      const chave = vec3(1.0, 0.92, 0.75).mul(rk.pow(220.0).mul(5.0).add(rk.pow(24.0).mul(0.35)));
      // núcleo: luz interna do sol (mais forte à noite, como o selo aceso)
      const nucleo = F0.mul(0.14).add(F0.mul(NdV.pow(2.2)).mul(U.solBrilho).mul(0.5)).add(vec3(1.0, 0.93, 0.75).mul(NdV.pow(14.0)).mul(U.solBrilho).mul(0.22));
      const aro = U.brilho.mul(float(1).sub(NdV).pow(3.0)).mul(0.6);
      // dentro da gravação: sulco mais fosco + brilho do Ato 3
      const sulco = h0.mul(frente).mul(U.gravar);
      const gravBrilho = F0.mul(h0.mul(frente).mul(U.gravarBrilho).mul(5.0));

      const cor = especular.add(nucleo).add(aro).add(chave).mul(float(1).sub(sulco.mul(0.35))).add(gravBrilho);
      return cor.add(vec3(1.0, 0.75, 0.25).mul(borda).mul(9.0));
    })();

    const m = new Mesh(geo, mat);
    m.frustumCulled = false;
    return m;
  }

  private criarCrescente(sky: any) {
    const R0 = 1.17, tubo = 0.055, arco = Math.PI * 1.32;
    const geo = new TorusGeometry(R0, tubo, 14, 220, arco);
    const mat = new MeshBasicNodeMaterial();
    const vN = varyingProperty('vec3', 'vNormalCresc');
    const vP = varyingProperty('vec3', 'vPosCresc');

    // afina nas pontas como uma pincelada
    mat.positionNode = Fn(() => {
      const u = uv().x;
      const ang = u.mul(arco);
      const centro = vec3(cos(ang).mul(R0), sin(ang).mul(R0), 0);
      const afina = sin(u.mul(PI)).pow(0.55).mul(float(1).add(sin(u.mul(PI)).mul(0.6)));
      const p = centro.add(positionLocal.sub(centro).mul(afina));
      vN.assign(normalize(modelWorldMatrix.mul(vec4(normalLocal, 0)).xyz));
      vP.assign(modelWorldMatrix.mul(vec4(p, 1)).xyz);
      return p;
    })();

    mat.colorNode = Fn(() => {
      Discard(U.materializar.lessThan(0.6));
      const N = normalize(vN);
      const V = normalize(cameraPosition.sub(vP));
      const NdV = max(dot(N, V), 0.0);
      const R = reflect(V.negate(), N);
      const F = float(0.06).add(float(0.94).mul(float(1).sub(NdV).pow(5.0)));
      const base = vec3(ESMALTE.r, ESMALTE.g, ESMALTE.b).mul(0.55);
      const amb = sky(R);
      const L = normalize(cameraPosition.sub(vP).add(vec3(2, 3, 0)));
      const spec = max(dot(reflect(L.negate(), N), V), 0.0).pow(60.0).mul(1.4);
      return mix(base, amb, F).add(spec).add(U.brilho.mul(float(1).sub(NdV).pow(2.0)).mul(0.25));
    })();

    const m = new Mesh(geo, mat);
    // orientação inspirada no logo: abraça o disco por baixo, à esquerda
    m.rotation.set(0.32, -0.18, Math.PI * 0.62);
    m.frustumCulled = false;
    return m;
  }

  // Chamado a cada quadro pelo Engine
  update(dt: number, tempo: number) {
    this.crescent.rotation.z = Math.PI * 0.62 + Math.sin(tempo * 0.21) * 0.08;
    this.crescent.visible = U.materializar.value > 0.55;
    this.group.visible = U.materializar.value > 0.001;
  }
}
