// AudioEngine: som de mar generativo (ruído rosa filtrado em ondas). Desligado por padrão.
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private ganho: GainNode | null = null;
  ligado = false;

  private montar() {
    const ctx = new AudioContext();
    // ruído rosa (filtro de Paul Kellet) em loop de 4 s
    const buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11;
    }
    const fonte = ctx.createBufferSource();
    fonte.buffer = buf;
    fonte.loop = true;
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = 500;
    // ondas: LFO lento abrindo o filtro e o volume
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.11;
    const lfoGanho = ctx.createGain();
    lfoGanho.gain.value = 380;
    lfo.connect(lfoGanho).connect(filtro.frequency);
    const onda = ctx.createGain();
    onda.gain.value = 0.6;
    const lfo2 = ctx.createOscillator();
    lfo2.frequency.value = 0.11;
    const lfo2Ganho = ctx.createGain();
    lfo2Ganho.gain.value = 0.35;
    lfo2.connect(lfo2Ganho).connect(onda.gain);
    this.ganho = ctx.createGain();
    this.ganho.gain.value = 0;
    fonte.connect(filtro).connect(onda).connect(this.ganho).connect(ctx.destination);
    fonte.start(); lfo.start(); lfo2.start();
    this.ctx = ctx;
  }

  alternar() {
    if (!this.ctx) this.montar();
    this.ligado = !this.ligado;
    const t = this.ctx!.currentTime;
    if (this.ligado) this.ctx!.resume();
    this.ganho!.gain.cancelScheduledValues(t);
    this.ganho!.gain.linearRampToValueAtTime(this.ligado ? 0.5 : 0, t + 1.2);
    return this.ligado;
  }
}
