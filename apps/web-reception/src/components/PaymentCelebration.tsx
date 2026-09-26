import { useEffect, useState } from "react";
import { CelebrationOverlay, SuccessMotion } from "@casacarlos/ui";

export function PaymentCelebration() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let timer: number | undefined;
    const show = () => {
      setVisible(true);
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setVisible(false), 7200);
    };
    window.addEventListener("casacarlos:payment-success", show);
    return () => {
      window.removeEventListener("casacarlos:payment-success", show);
      if (timer) window.clearTimeout(timer);
    };
  }, []);
  if (!visible) return null;
  return (
    <>
      <CelebrationOverlay duration={6800} />
      <div className="pointer-events-none fixed inset-x-0 top-20 z-[110] flex justify-center px-4">
        <div className="animate-pop relative flex items-center gap-3 rounded-2xl border border-brand/30 bg-surface/95 px-5 py-3 shadow-[var(--shadow-pop)] backdrop-blur">
          <SuccessMotion className="absolute -left-5 -top-7 h-24 w-24" />
          <span className="relative grid h-9 w-9 place-items-center rounded-full bg-brand text-lg font-bold text-brand-ink">✓</span>
          <span><span className="block text-sm font-semibold text-ink">Pago confirmado</span><span className="block text-xs text-muted">La operación quedó registrada en caja.</span></span>
        </div>
      </div>
    </>
  );
}
