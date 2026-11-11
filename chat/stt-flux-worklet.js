/* Capture micro brute pour la transcription en continu : blocs de 2048 échantillons (≈ 43 ms à 48 kHz) vers le fil principal. */
class SttFluxPcm extends AudioWorkletProcessor {
  constructor() { super(); this.b = new Float32Array(2048); this.n = 0; }
  process(entrees) {
    var c = entrees[0] && entrees[0][0];
    if (c) {
      for (var i = 0; i < c.length; i++) {
        this.b[this.n++] = c[i];
        if (this.n === this.b.length) { this.port.postMessage(this.b.slice(0)); this.n = 0; }
      }
    }
    return true;
  }
}
registerProcessor('stt-flux-pcm', SttFluxPcm);
