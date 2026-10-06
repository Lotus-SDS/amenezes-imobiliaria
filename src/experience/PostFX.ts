// Pós-processamento: bloom físico multinível + gradação da marca → AgX (saída do pipeline).
// Vinheta e grão ficam em CSS (custo zero na GPU, iguais em todos os tiers).
import { RenderPipeline } from 'three/webgpu';
import { pass, uniform, vec3, vec4, float, mix, dot, smoothstep } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';

export class PostFX {
  pipeline: RenderPipeline;
  forca = uniform(0.42);
  private bloomNode: any;

  constructor(renderer: any, scene: any, camera: any, opts: { msaa: number }) {
    this.pipeline = new RenderPipeline(renderer);
    const cena = pass(scene, camera, { samples: opts.msaa });
    const cor = cena.getTextureNode('output');
    this.bloomNode = bloom(cor, this.forca, 0.42, 1.0);
    let saida: any = cor.add(this.bloomNode);

    // "LUT" da marca: sombras puxadas para o azul Menezes, altas luzes para o ouro (split toning leve)
    const luma = dot(saida.rgb, vec3(0.2126, 0.7152, 0.0722));
    const sombra = vec3(0.06, 0.07, 0.2);
    const luz = vec3(1.0, 0.86, 0.55);
    const tonificado = mix(
      saida.rgb.add(sombra.mul(float(0.06).mul(smoothstep(0.35, 0.0, luma)))),
      saida.rgb.mul(mix(vec3(1), luz, 0.08)),
      smoothstep(0.4, 1.5, luma),
    );
    saida = vec4(tonificado, 1.0);
    this.pipeline.outputNode = saida;
  }

  desligarBloom() {
    this.forca.value = 0;
  }

  render() {
    this.pipeline.render();
  }
}
