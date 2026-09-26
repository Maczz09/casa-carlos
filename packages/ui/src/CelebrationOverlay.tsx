import { useEffect, useRef } from "react";
import { playCelebrationAudio } from "./celebrationAudio.js";

export function CelebrationOverlay({ duration = 6800, sound = true }: { duration?: number; sound?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    const stopAudio = sound ? playCelebrationAudio(duration) : undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return stopAudio;
    const element = host.current;
    let disposed = false;
    let timer: number | undefined;
    let stop: (() => void) | undefined;
    void import("fireworks-js").then(({ Fireworks }) => {
      if (disposed || !element.isConnected) return;
      const fireworks = new Fireworks(element, {
        autoresize: true,
        opacity: 0.68,
        acceleration: 1.035,
        friction: 0.965,
        gravity: 1.3,
        particles: 96,
        traceLength: 4,
        traceSpeed: 11,
        explosion: 8,
        intensity: 36,
        delay: { min: 12, max: 26 },
        brightness: { min: 58, max: 88 },
        decay: { min: 0.012, max: 0.024 },
        flickering: 64,
        rocketsPoint: { min: 10, max: 90 },
        lineWidth: {
          explosion: { min: 1.2, max: 2.4 },
          trace: { min: 1, max: 1.7 },
        },
      });
      fireworks.start();
      timer = window.setTimeout(() => fireworks.stop(), duration);
      stop = () => {
        fireworks.stop();
        fireworks.clear();
      };
    });
    return () => {
      disposed = true;
      if (timer) window.clearTimeout(timer);
      stop?.();
      stopAudio?.();
    };
  }, [duration, sound]);
  return <div ref={host} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[100]" />;
}
