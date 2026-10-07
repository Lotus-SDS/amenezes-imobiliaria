// Céu procedural guiado pela hora do dia: gradiente, brilho do sol, bruma, nuvens e estrelas.
// A mesma função é usada no domo, no reflexo do mar e no ambiente do ouro (tudo coerente, zero HDRI).
import {
  Fn, float, vec2, vec3, mix, smoothstep, cameraPosition, max, mx_cell_noise_float, mx_fractal_noise_float, sin,
} from 'three/tsl';
import { U } from '../uniforms';

// oitavasNuvem = 0 e estrelas = false: céu liso, sem ruído (névoa e reflexos pequenos, onde nuvem e estrela não aparecem)
export const makeSky = (oitavasNuvem: number, estrelas = true) =>
  Fn(([dirIn]: any[]) => {
    const d = dirIn.normalize();
    const up = max(d.y, 0.0);
    // gradiente zênite → horizonte (curva forte perto do horizonte)
    const t = float(1).sub(up.div(0.42).min(1.0)).pow(2.4);
    const base = mix(U.zenite, U.horizonte, t).toVar();

    // brilho ao redor do sol (direção vista da câmera)
    const solDir = U.solPos.sub(cameraPosition).normalize();
    const s = max(d.dot(solDir), 0.0);
    const halo = s.pow(9.0).mul(0.2).add(s.pow(60.0).mul(0.7)).mul(U.solBrilho).mul(U.materializar.mul(0.7).add(0.3));
    base.addAssign(U.brilho.mul(halo));

    // faixa de bruma no horizonte, mais quente do lado do sol
    const faixa = float(1).sub(d.y.abs()).pow(28.0);
    base.addAssign(mix(U.horizonte, U.brilho, s.pow(3.0)).mul(faixa).mul(0.32));

    // nuvens finas e alongadas (projeção plana do céu)
    if (oitavasNuvem > 0) {
      const p = d.xz.div(d.y.add(0.12)).mul(vec2(0.35, 1.1));
      const n = mx_fractal_noise_float(vec3(p.x.add(U.tempo.mul(0.004)), p.y, U.tempo.mul(0.006)), oitavasNuvem, 2.0, 0.5);
      const forma = smoothstep(0.05, 0.55, n).mul(smoothstep(0.0, 0.08, d.y)).mul(smoothstep(0.55, 0.15, d.y));
      const corNuvem = mix(U.zenite.mul(1.6).add(U.horizonte.mul(0.25)), U.brilho.mul(1.3), s.pow(2.0).add(t.mul(0.4)).min(1.0));
      base.assign(mix(base, corNuvem, forma.mul(U.nuvens)));
    }

    // estrelas: células com cintilação, só acima do horizonte
    if (estrelas) {
      const cel = d.mul(260.0).floor();
      const r = mx_cell_noise_float(cel);
      const pisca = sin(U.tempo.mul(r.mul(3.0).add(1.0)).add(r.mul(40.0))).mul(0.35).add(0.65);
      const estrela = smoothstep(0.9965, 1.0, r).mul(pisca).mul(smoothstep(0.02, 0.25, d.y)).mul(U.estrelas).mul(2.2);
      base.addAssign(vec3(0.85, 0.9, 1.0).mul(estrela));
    }

    // abaixo do horizonte (só aparece além do mar): horizonte escurecido
    return mix(base, U.horizonte.mul(0.55), smoothstep(0.0, -0.08, d.y));
  });
