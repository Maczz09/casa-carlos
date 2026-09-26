let celebrationAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextClass =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  celebrationAudioContext ??= new AudioContextClass();
  return celebrationAudioContext;
}

/**
 * Se llama desde el clic que inicia el pago para desbloquear Web Audio. Esto
 * permite que el sonido siga disponible cuando el kiosco recibe la aprobación
 * de Recepción varios segundos después.
 */
export function prepareCelebrationAudio() {
  const context = getAudioContext();
  if (!context) return;
  void context.resume();

  const source = context.createBufferSource();
  source.buffer = context.createBuffer(1, 1, context.sampleRate);
  source.connect(context.destination);
  source.start();
}

function createNoiseBuffer(context: AudioContext, durationSeconds: number) {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * durationSeconds), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    const envelope = 1 - index / data.length;
    data[index] = (Math.random() * 2 - 1) * envelope;
  }
  return buffer;
}

/** Reproduce una secuencia local de lanzamientos y explosiones suaves. */
export function playCelebrationAudio(durationMs = 6800) {
  const context = getAudioContext();
  if (!context) return () => {};
  void context.resume();

  const master = context.createGain();
  master.gain.setValueAtTime(0.42, context.currentTime);
  master.connect(context.destination);

  const activeSources: AudioScheduledSourceNode[] = [];
  const noise = createNoiseBuffer(context, 0.72);
  const burstOffsets = [0, 520, 1080, 1740, 2460, 3220, 4040, 4880, 5680, 6240];
  const usableOffsets = burstOffsets.filter((offset) => offset < durationMs - 260);

  for (const [index, offset] of usableOffsets.entries()) {
    const launchAt = context.currentTime + offset / 1000;
    const explodeAt = launchAt + 0.28 + (index % 3) * 0.035;

    const launch = context.createOscillator();
    const launchGain = context.createGain();
    launch.type = "sine";
    launch.frequency.setValueAtTime(310 + index * 18, launchAt);
    launch.frequency.exponentialRampToValueAtTime(980 + index * 24, explodeAt);
    launchGain.gain.setValueAtTime(0.0001, launchAt);
    launchGain.gain.exponentialRampToValueAtTime(0.075, launchAt + 0.07);
    launchGain.gain.exponentialRampToValueAtTime(0.0001, explodeAt);
    launch.connect(launchGain);
    launchGain.connect(master);
    launch.start(launchAt);
    launch.stop(explodeAt + 0.02);
    activeSources.push(launch);

    const explosion = context.createBufferSource();
    const explosionFilter = context.createBiquadFilter();
    const explosionGain = context.createGain();
    explosion.buffer = noise;
    explosion.playbackRate.setValueAtTime(0.88 + (index % 4) * 0.07, explodeAt);
    explosionFilter.type = "lowpass";
    explosionFilter.frequency.setValueAtTime(1450 + (index % 3) * 260, explodeAt);
    explosionFilter.frequency.exponentialRampToValueAtTime(180, explodeAt + 0.68);
    explosionGain.gain.setValueAtTime(0.0001, explodeAt);
    explosionGain.gain.exponentialRampToValueAtTime(0.17, explodeAt + 0.012);
    explosionGain.gain.exponentialRampToValueAtTime(0.0001, explodeAt + 0.68);
    explosion.connect(explosionFilter);
    explosionFilter.connect(explosionGain);
    explosionGain.connect(master);
    explosion.start(explodeAt);
    explosion.stop(explodeAt + 0.72);
    activeSources.push(explosion);
  }

  return () => {
    for (const source of activeSources) {
      try {
        source.stop();
      } catch {
        // La fuente ya terminó de reproducirse.
      }
      source.disconnect();
    }
    master.disconnect();
  };
}
