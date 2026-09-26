import { useEffect, useRef } from "react";

const pulseAnimation = {
  v: "5.10.0",
  fr: 60,
  ip: 0,
  op: 90,
  w: 200,
  h: 200,
  nm: "success-pulse",
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "pulse",
      sr: 1,
      ks: {
        o: { a: 1, k: [{ t: 0, s: [70] }, { t: 55, s: [18] }, { t: 90, s: [0] }] },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [100, 100, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 1, k: [{ t: 0, s: [45, 45, 100] }, { t: 70, s: [112, 112, 100] }, { t: 90, s: [122, 122, 100] }] },
      },
      ao: 0,
      shapes: [
        {
          ty: "gr",
          it: [
            { d: 1, ty: "el", s: { a: 0, k: [145, 145] }, p: { a: 0, k: [0, 0] }, nm: "Ellipse" },
            { ty: "st", c: { a: 0, k: [0.18, 0.83, 0.75, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 8 }, lc: 2, lj: 2, nm: "Stroke" },
            { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 } },
          ],
          nm: "Pulse",
        },
      ],
      ip: 0,
      op: 90,
      st: 0,
      bm: 0,
    },
  ],
  markers: [],
};

export function SuccessMotion({ className }: { className?: string }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const element = container.current;
    let disposed = false;
    let destroy: (() => void) | undefined;
    void import("lottie-web").then(({ default: lottie }) => {
      if (disposed || !element.isConnected) return;
      const animation = lottie.loadAnimation({ container: element, renderer: "svg", loop: true, autoplay: true, animationData: pulseAnimation });
      destroy = () => animation.destroy();
    });
    return () => {
      disposed = true;
      destroy?.();
    };
  }, []);
  return <div ref={container} aria-hidden="true" className={className} />;
}
